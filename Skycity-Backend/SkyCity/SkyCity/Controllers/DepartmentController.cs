using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;
using System.Security.Claims;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("departments")]
public class DepartmentController : ControllerBase
{
    private readonly AppDbContext _context;
    public DepartmentController(AppDbContext context) => _context = context;

    private int CurrentAssocId => int.TryParse(User.FindFirst("AssociationId")?.Value, out var id) ? id : 0;

    [HttpGet]
    public async Task<ActionResult> GetAll()
    {
        var items = await _context.Departments
            .Where(d => d.AssociationId == CurrentAssocId || d.AssociationId == 0)
            .OrderBy(d => d.DepartmentName)
            .ToListAsync();
        return Ok(new ApiResponse<dynamic> { Success = true, Data = items });
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] DepartmentDto dto)
    {
        var dept = new Department { DepartmentName = dto.DepartmentName, AssociationId = CurrentAssocId };
        _context.Departments.Add(dept);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<Department> { Success = true, Data = dept });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] DepartmentDto dto)
    {
        var dept = await _context.Departments.FindAsync(id);
        if (dept == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        dept.DepartmentName = dto.DepartmentName;
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Updated" });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        var dept = await _context.Departments.FindAsync(id);
        if (dept == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        _context.Departments.Remove(dept);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Deleted" });
    }
}

public class DepartmentDto { public string DepartmentName { get; set; } = string.Empty; }
