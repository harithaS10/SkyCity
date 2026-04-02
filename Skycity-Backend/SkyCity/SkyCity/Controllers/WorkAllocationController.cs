using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;
using System.Security.Claims;

using SkycityBackend.Attributes;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("workallocations")]
public class WorkAllocationController : ControllerBase
{
    private readonly AppDbContext _context;
    public WorkAllocationController(AppDbContext context) => _context = context;

    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    private int CurrentAssocId => int.TryParse(User.FindFirst("AssociationId")?.Value, out var id) ? id : 0;

    [HttpGet("all")]
    public async Task<ActionResult> GetAll()
    {
        var items = await _context.WorkAllocations
            .Where(a => a.AssociationId == CurrentAssocId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();
        return Ok(new ApiResponse<dynamic> { Success = true, Data = items });
    }

    [HttpGet("my-tasks")]
    public async Task<ActionResult> GetMyTasks()
    {
        var items = await _context.WorkAllocations
            .Where(a => a.AssignedTo == CurrentUserId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();
        return Ok(new ApiResponse<dynamic> { Success = true, Data = items });
    }

    [HttpGet("live")]
    public async Task<ActionResult> GetLive()
    {
        var items = await _context.WorkAllocations
            .Where(a => a.AssociationId == CurrentAssocId && a.Status == "in-progress")
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();
        return Ok(new ApiResponse<dynamic> { Success = true, Data = items });
    }

    [RequirePermission("work_orders", "create")]
    [HttpPost("self-assign")]
    public async Task<ActionResult> SelfAssign([FromBody] SelfAssignDto dto)
    {
        var alloc = new WorkAllocation
        {
            Title = dto.Title,
            Description = dto.Description,
            WorkId = dto.WorkId,
            AssignedTo = CurrentUserId,
            AssignedBy = CurrentUserId,
            AssociationId = CurrentAssocId,
            Priority = dto.Priority ?? "medium",
            Status = "pending",
            DueDate = dto.DueDate,
            CreatedAt = DateTime.UtcNow
        };
        _context.WorkAllocations.Add(alloc);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<dynamic> { Success = true, Message = "Work started and admin notified", Data = alloc });
    }

    [RequirePermission("work_orders", "create")]
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateAllocationDto dto)
    {
        var allocations = new List<WorkAllocation>();
        foreach (var userId in dto.AssignedToIds)
        {
            var alloc = new WorkAllocation
            {
                Title = dto.Title,
                Description = dto.Description ?? dto.UserDescriptions?.GetValueOrDefault(userId),
                WorkId = dto.WorkId,
                AssignedTo = userId,
                AssignedBy = CurrentUserId,
                AssociationId = CurrentAssocId,
                Priority = dto.Priority ?? "medium",
                Status = "pending",
                DueDate = dto.DueDate,
                CreatedAt = DateTime.UtcNow
            };
            allocations.Add(alloc);
        }
        _context.WorkAllocations.AddRange(allocations);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<dynamic> { Success = true, Data = allocations });
    }

    [HttpPost("{id}/status")]
    public async Task<ActionResult> UpdateStatus(int id, [FromBody] UpdateStatusDto dto)
    {
        var alloc = await _context.WorkAllocations.FindAsync(id);
        if (alloc == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        alloc.Status = dto.Status;
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Status updated" });
    }

    [HttpPost("{id}/progress")]
    public async Task<ActionResult> UpdateProgress(int id, [FromBody] ProgressDto dto)
    {
        var alloc = await _context.WorkAllocations.FindAsync(id);
        if (alloc == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        alloc.ProgressNote = dto.ProgressNote;
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Progress updated" });
    }

    [HttpPost("{id}/delete")]
    public async Task<ActionResult> Delete(int id)
    {
        var alloc = await _context.WorkAllocations.FindAsync(id);
        if (alloc == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        _context.WorkAllocations.Remove(alloc);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Deleted" });
    }

    [HttpPost("{id}/reassign")]
    public async Task<ActionResult> Reassign(int id, [FromBody] ReassignDto dto)
    {
        var alloc = await _context.WorkAllocations.FindAsync(id);
        if (alloc == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        alloc.ReassignedFrom = alloc.AssignedTo;
        alloc.AssignedTo = dto.NewUserId;
        alloc.ReassignReason = dto.Reason;
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Reassigned" });
    }

    [HttpPost("{id}/approve-request")]
    public async Task<ActionResult> ApproveRequest(int id)
    {
        var alloc = await _context.WorkAllocations.FindAsync(id);
        if (alloc == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        alloc.RequestStatus = "approved";
        if (alloc.RequestedDueDate.HasValue) alloc.DueDate = alloc.RequestedDueDate.Value;
        if (alloc.RequestedDescription != null) alloc.Description = alloc.RequestedDescription;
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Request approved" });
    }

    [HttpPost("{id}/deny-request")]
    public async Task<ActionResult> DenyRequest(int id)
    {
        var alloc = await _context.WorkAllocations.FindAsync(id);
        if (alloc == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        alloc.RequestStatus = "rejected";
        alloc.RequestedDueDate = null;
        alloc.RequestedDescription = null;
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Request denied" });
    }
}

public class CreateAllocationDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int WorkId { get; set; }
    public List<int> AssignedToIds { get; set; } = new();
    public DateTime DueDate { get; set; }
    public string? Priority { get; set; }
    public Dictionary<int, string>? UserDescriptions { get; set; }
}

public class UpdateStatusDto { public string Status { get; set; } = string.Empty; }
public class ProgressDto { public string ProgressNote { get; set; } = string.Empty; }
public class ReassignDto { public int NewUserId { get; set; } public string? Reason { get; set; } }
public class SelfAssignDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int WorkId { get; set; }
    public string? ClientId { get; set; }
    public string Priority { get; set; } = "medium";
    public DateTime DueDate { get; set; }
}
