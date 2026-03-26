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

    [Authorize(Roles = "super_admin,admin,sub_admin,property_manager")]
    [HttpPost]
    public async Task<ActionResult> CreateProperty([FromBody] CreatePropertyDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(new ApiResponse { Success = false, Message = "Invalid input" });

        var userAssocId = int.Parse(User.FindFirst("AssociationId")?.Value ?? "0");
        if (dto.AssociationId != userAssocId && !User.IsInRole("super_admin"))
            return Forbid();

        var property = new Property
        {
            AssociationId = dto.AssociationId,
            PropertyName = dto.PropertyName,
            Address = dto.Address,
            TotalUnits = dto.TotalUnits,
            CreatedAt = DateTime.UtcNow
        };

        _context.Properties.Add(property);
        await _context.SaveChangesAsync();

        await _auditService.LogChangeAsync<Property>("Create", "Property", property);

        return CreatedAtAction(nameof(GetProperties), new { associationId = property.AssociationId }, new ApiResponse<Property> { Data = property });
    }

    [Authorize(Roles = "super_admin,admin,property_manager")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProperty(int id)
    {
        var property = await _context.Properties.FindAsync(id);
        if (property == null)
            return NotFound(new ApiResponse { Success = false, Message = "Not Found" });

        _context.Properties.Remove(property);
        await _context.SaveChangesAsync();

        await _auditService.LogChangeAsync<Property>("Delete", "Property", property);
        return Ok(new ApiResponse { Message = "Deleted successfully" });
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
