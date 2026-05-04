using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.DTOs;
using SkycityBackend.Models;
using SkycityBackend.Services;
using System.Security.Claims;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("property")]
public class PropertyController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;

    public PropertyController(AppDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    [HttpGet("association/{associationId}")]
    public async Task<ActionResult> GetProperties(int associationId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _context.Properties
            .Where(p => p.AssociationId == associationId)
            .AsQueryable();

        var total = await query.CountAsync();
        var items = await query
            .OrderBy(p => p.PropertyName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new ApiResponse<dynamic>
        {
            Data = new
            {
                Total = total,
                Page = page,
                PageSize = pageSize,
                Items = items
            }
        });
    }

    // Diagnostic: list actual table names in the DB
    [AllowAnonymous]
    [HttpGet("db-tables")]
    public async Task<ActionResult> GetDbTables()
    {
        var tables = await _context.Database
            .SqlQueryRaw<string>("SELECT TABLE_SCHEMA + '.' + TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")
            .ToListAsync();
        var db = _context.Database.GetDbConnection().Database;
        return Ok(new { database = db, tables });
    }

    [Authorize(Roles = "super_admin,admin,sub_admin,property_manager")]
    [HttpPost("bulk")]
    public async Task<ActionResult> CreatePropertiesBulk([FromBody] BulkCreatePropertyDto dto)
    {
        if (dto.Properties == null || dto.Properties.Count == 0)
            return BadRequest(new ApiResponse { Success = false, Message = "No properties provided" });

        var userAssocId = int.Parse(User.FindFirst("AssociationId")?.Value ?? "0");

        var properties = dto.Properties.Select(p => new Property
        {
            AssociationId = userAssocId,
            PropertyName  = p.PropertyName,
            Address       = p.Address,
            TotalUnits    = 0,
            PropertyType  = p.PropertyType ?? "apartment",
            TowerName     = p.TowerName,
            FloorNo       = p.FloorNo,
            DoorNo        = p.DoorNo,
            ContactName   = p.ContactName,
            ContactMobile = p.ContactMobile,
            CommonAreas   = p.CommonAreas != null && p.CommonAreas.Count > 0
                                ? string.Join(",", p.CommonAreas) : null,
            CreatedAt     = DateTime.UtcNow
        }).ToList();

        _context.Properties.AddRange(properties);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<dynamic> { Success = true, Data = new { Created = properties.Count }, Message = $"{properties.Count} properties created" });
    }

    [Authorize(Roles = "super_admin,admin,sub_admin,property_manager")]
    [HttpPost]
    public async Task<ActionResult> CreateProperty([FromBody] CreatePropertyDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(new ApiResponse { Success = false, Message = "Invalid input" });

        var userAssocId = int.Parse(User.FindFirst("AssociationId")?.Value ?? "0");
        // Use JWT association — ignore body AssociationId for non-super-admins
        var assocId = User.IsInRole("super_admin") && dto.AssociationId > 0
            ? dto.AssociationId
            : userAssocId;

        var property = new Property
        {
            AssociationId = assocId,
            PropertyName  = dto.PropertyName,
            Address       = dto.Address,
            TotalUnits    = dto.TotalUnits,
            PropertyType  = dto.PropertyType ?? "apartment",
            TowerName     = dto.TowerName,
            FloorNo       = dto.FloorNo,
            DoorNo        = dto.DoorNo,
            ContactName   = dto.ContactName,
            ContactMobile = dto.ContactMobile,
            CommonAreas   = dto.CommonAreas != null && dto.CommonAreas.Count > 0
                                ? string.Join(",", dto.CommonAreas)
                                : null,
            CreatedAt     = DateTime.UtcNow
        };

        _context.Properties.Add(property);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
        {
            var inner = ex.InnerException?.Message ?? ex.Message;
            return StatusCode(500, new ApiResponse { Success = false, Message = $"DB error: {inner}" });
        }

        try { await _auditService.LogChangeAsync<Property>("Create", "Property", property); } catch { /* non-critical */ }

        return CreatedAtAction(nameof(GetProperties), new { associationId = property.AssociationId }, new ApiResponse<Property> { Data = property });
    }

    [Authorize(Roles = "super_admin,admin,sub_admin,property_manager")]
    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateProperty(int id, [FromBody] CreatePropertyDto dto)
    {
        var property = await _context.Properties.FindAsync(id);
        if (property == null)
            return NotFound(new ApiResponse { Success = false, Message = "Not found" });

        property.PropertyName  = dto.PropertyName;
        property.Address       = dto.Address;
        property.PropertyType  = dto.PropertyType ?? property.PropertyType;
        property.TowerName     = dto.TowerName;
        property.FloorNo       = dto.FloorNo;
        property.DoorNo        = dto.DoorNo;
        property.ContactName   = dto.ContactName;
        property.ContactMobile = dto.ContactMobile;
        property.CommonAreas   = dto.CommonAreas != null && dto.CommonAreas.Count > 0
                                    ? string.Join(",", dto.CommonAreas)
                                    : property.CommonAreas;

        await _context.SaveChangesAsync();
        await _auditService.LogChangeAsync<Property>("Update", "Property", property);

        return Ok(new ApiResponse<Property> { Success = true, Data = property });
    }

    [Authorize(Roles = "super_admin,admin,property_manager")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProperty(int id)
    {
        var property = await _context.Properties.FindAsync(id);
        if (property == null)
            return NotFound(new ApiResponse { Success = false, Message = "Not Found" });

        // Soft delete — sets IsDeleted = false (excluded by global query filter)
        property.IsDeleted = false;
        await _context.SaveChangesAsync();

        await _auditService.LogChangeAsync<Property>("Delete", "Property", property);
        return Ok(new ApiResponse { Success = true, Message = "Property deleted" });
    }

    [HttpGet("property/{propertyId}/buildings")]
    public async Task<ActionResult> GetBuildings(int propertyId)
    {
        var buildings = await _context.Buildings
            .Where(b => b.PropertyId == propertyId)
            .ToListAsync();
            
        return Ok(new ApiResponse<IEnumerable<Building>> { Data = buildings });
    }

    [Authorize(Roles = "super_admin,admin,sub_admin,property_manager")]
    [HttpPost("building")]
    public async Task<ActionResult> CreateBuilding([FromBody] CreateBuildingDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(new ApiResponse { Success = false, Message = "Invalid input" });

        var building = new Building
        {
            PropertyId = dto.PropertyId,
            BuildingName = dto.BuildingName,
            Floors = dto.Floors,
            CreatedAt = DateTime.UtcNow
        };

        _context.Buildings.Add(building);
        await _context.SaveChangesAsync();

        await _auditService.LogChangeAsync<Building>("Create", "Building", building);

        return Ok(new ApiResponse<Building> { Data = building });
    }

    [Authorize(Roles = "super_admin,admin,property_manager")]
    [HttpDelete("building/{id}")]
    public async Task<IActionResult> DeleteBuilding(int id)
    {
        var building = await _context.Buildings.FindAsync(id);
        if (building == null)
            return NotFound(new ApiResponse { Success = false, Message = "Not Found" });

        _context.Buildings.Remove(building);
        await _context.SaveChangesAsync();

        await _auditService.LogChangeAsync<Building>("Delete", "Building", building);
        return Ok(new ApiResponse { Message = "Deleted successfully" });
    }

    [HttpGet("building/{buildingId}/units")]
    public async Task<ActionResult> GetUnits(int buildingId)
    {
        var units = await _context.Units
            .Where(u => u.BuildingId == buildingId)
            .ToListAsync();
            
        return Ok(new ApiResponse<IEnumerable<Unit>> { Data = units });
    }

    [Authorize(Roles = "super_admin,admin,sub_admin,property_manager")]
    [HttpPost("units/bulk")]
    public async Task<ActionResult> CreateUnitsBulk([FromBody] BulkCreateUnitsDto dto)
    {
        if (dto.BuildingId <= 0 || dto.UnitsPerFloor <= 0 || dto.FromFloor < 1 || dto.ToFloor < dto.FromFloor)
            return BadRequest(new ApiResponse { Success = false, Message = $"Invalid parameters: buildingId={dto.BuildingId}, fromFloor={dto.FromFloor}, toFloor={dto.ToFloor}, unitsPerFloor={dto.UnitsPerFloor}" });

        var units = new List<Unit>();
        for (int floor = dto.FromFloor; floor <= dto.ToFloor; floor++)
        {
            for (int u = 1; u <= dto.UnitsPerFloor; u++)
            {
                var unitNumber = $"{floor}{u:D2}"; // e.g. 101, 102, 201...
                units.Add(new Unit
                {
                    BuildingId = dto.BuildingId,
                    UnitNumber = unitNumber,
                    FloorNumber = floor,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        _context.Units.AddRange(units);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<dynamic> { Success = true, Data = new { Created = units.Count }, Message = $"{units.Count} units created" });
    }

    [Authorize(Roles = "super_admin,admin,sub_admin,property_manager")]
    [HttpPost("unit")]
    public async Task<ActionResult> CreateUnit([FromBody] CreateUnitDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(new ApiResponse { Success = false, Message = "Invalid input" });

        var unit = new Unit
        {
            BuildingId = dto.BuildingId,
            UnitNumber = dto.UnitNumber,
            FloorNumber = dto.FloorNumber,
            Area = dto.Area,
            ResidentId = dto.ResidentId,
            CreatedAt = DateTime.UtcNow
        };

        _context.Units.Add(unit);
        await _context.SaveChangesAsync();

        await _auditService.LogChangeAsync<Unit>("Create", "Unit", unit);

        return Ok(new ApiResponse<Unit> { Data = unit });
    }

    [Authorize(Roles = "super_admin,admin,property_manager")]
    [HttpDelete("unit/{id}")]
    public async Task<IActionResult> DeleteUnit(int id)
    {
        var unit = await _context.Units.FindAsync(id);
        if (unit == null)
            return NotFound(new ApiResponse { Success = false, Message = "Not Found" });

        _context.Units.Remove(unit);
        await _context.SaveChangesAsync();

        await _auditService.LogChangeAsync<Unit>("Delete", "Unit", unit);
        return Ok(new ApiResponse { Message = "Deleted successfully" });
    }
}
