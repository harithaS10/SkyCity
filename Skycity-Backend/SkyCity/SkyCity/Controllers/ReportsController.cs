using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;
using System.Security.Claims;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("reports")]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _context;
    public ReportsController(AppDbContext context) => _context = context;

    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    private int CurrentAssocId => int.TryParse(User.FindFirst("AssociationId")?.Value, out var id) ? id : 0;

    [HttpGet]
    public async Task<ActionResult> GetAll(
        [FromQuery] int? adminId,
        [FromQuery] int? userId,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] string? workTitles)
    {
        var query = _context.WorkAllocations
            .Where(a => a.AssociationId == CurrentAssocId)
            .AsQueryable();

        if (userId.HasValue)
            query = query.Where(a => a.AssignedTo == userId.Value);

        if (startDate.HasValue)
            query = query.Where(a => a.CreatedAt >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(a => a.CreatedAt <= endDate.Value.AddDays(1));

        if (!string.IsNullOrEmpty(workTitles))
        {
            var titles = workTitles.Split(',').Select(t => t.Trim()).ToList();
            query = query.Where(a => titles.Contains(a.Title));
        }

        var items = await query.OrderByDescending(a => a.CreatedAt).ToListAsync();
        return Ok(new ApiResponse<dynamic> { Success = true, Data = items });
    }

    // GET /reports/standing-pending — work assigned but not yet completed
    [HttpGet("standing-pending")]
    public async Task<ActionResult> GetStandingPending()
    {
        var items = await _context.WorkAllocations
            .Where(a => a.AssociationId == CurrentAssocId && a.Status != "completed")
            .OrderBy(a => a.DueDate)
            .ToListAsync();

        var userIds = items.Select(a => a.AssignedTo).Distinct().ToList();
        var users = await _context.Users
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FullName })
            .ToListAsync();
        var userMap = users.ToDictionary(u => u.Id, u => u.FullName);

        var result = items.Select(a => new
        {
            a.Id, a.Title, a.Description, a.Priority, a.Status, a.DueDate, a.CreatedAt,
            assignedToName = userMap.GetValueOrDefault(a.AssignedTo, "Unknown"),
        });

        return Ok(new ApiResponse<dynamic> { Success = true, Data = result });
    }

    // GET /reports/pending-to-completed — work that was pending and is now completed
    [HttpGet("pending-to-completed")]
    public async Task<ActionResult> GetPendingToCompleted()
    {
        var items = await _context.WorkAllocations
            .Where(a => a.AssociationId == CurrentAssocId && a.Status == "completed")
            .OrderByDescending(a => a.CompletedAt)
            .ToListAsync();

        var userIds = items.Select(a => a.AssignedTo).Distinct().ToList();
        var users = await _context.Users
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FullName })
            .ToListAsync();
        var userMap = users.ToDictionary(u => u.Id, u => u.FullName);

        var result = items.Select(a => new
        {
            a.Id, a.Title, a.Description, a.Priority, a.CompletedAt, a.Duration, a.CreatedAt,
            assignedToName = userMap.GetValueOrDefault(a.AssignedTo, "Unknown"),
        });

        return Ok(new ApiResponse<dynamic> { Success = true, Data = result });
    }

    // GET /reports/reassignment-history — work that was reassigned
    [HttpGet("reassignment-history")]
    public async Task<ActionResult> GetReassignmentHistory()
    {
        var items = await _context.WorkAllocations
            .Where(a => a.AssociationId == CurrentAssocId && a.ReassignedFrom != null)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        var allUserIds = items
            .SelectMany(a => new[] { a.AssignedTo, a.ReassignedFrom ?? 0 })
            .Distinct().ToList();
        var users = await _context.Users
            .Where(u => allUserIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FullName })
            .ToListAsync();
        var userMap = users.ToDictionary(u => u.Id, u => u.FullName);

        var result = items.Select(a => new
        {
            a.Id, a.Title, a.Description, a.Priority, a.Status,
            a.ReassignReason,
            a.CompletedAt,
            originalAssignDate = a.CreatedAt,
            reassignedDate = a.CreatedAt,   // best available proxy
            completedDate = a.CompletedAt,
            reason = a.ReassignReason,
            assignedToName = userMap.GetValueOrDefault(a.AssignedTo, "Unknown"),
            previousAssigneeName = a.ReassignedFrom.HasValue
                ? userMap.GetValueOrDefault(a.ReassignedFrom.Value, "Unknown")
                : "Unknown",
        });

        return Ok(new ApiResponse<dynamic> { Success = true, Data = result });
    }

    // DELETE /reports/completed — clear completed work records
    [HttpDelete("completed")]
    public async Task<ActionResult> ClearCompleted()
    {
        var items = await _context.WorkAllocations
            .Where(a => a.AssociationId == CurrentAssocId && a.Status == "completed")
            .ToListAsync();
        _context.WorkAllocations.RemoveRange(items);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = $"Cleared {items.Count} completed records." });
    }

    // DELETE /reports/reassignment-history — clear reassignment history
    [HttpDelete("reassignment-history")]
    public async Task<ActionResult> ClearReassignmentHistory()
    {
        var items = await _context.WorkAllocations
            .Where(a => a.AssociationId == CurrentAssocId && a.ReassignedFrom != null)
            .ToListAsync();
        foreach (var item in items)
        {
            item.ReassignedFrom = null;
            item.ReassignReason = null;
        }
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = $"Cleared reassignment history for {items.Count} records." });
    }

    [HttpGet("my-reports")]
    public async Task<ActionResult> GetMyReports(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate)
    {
        var query = _context.WorkAllocations
            .Where(a => a.AssignedTo == CurrentUserId)
            .AsQueryable();

        if (startDate.HasValue)
            query = query.Where(a => a.CreatedAt >= startDate.Value);

        if (endDate.HasValue)
            query = query.Where(a => a.CreatedAt <= endDate.Value.AddDays(1));

        var items = await query.OrderByDescending(a => a.CreatedAt).ToListAsync();
        return Ok(new ApiResponse<dynamic> { Success = true, Data = items });
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateReportDto dto)
    {
        var report = new WorkAllocation
        {
            Title = dto.Title,
            Description = dto.Description,
            WorkId = dto.WorkId ?? 0,
            AssignedTo = CurrentUserId,
            AssignedBy = CurrentUserId,
            AssociationId = CurrentAssocId,
            Priority = dto.Priority ?? "medium",
            Status = dto.Status ?? "completed",
            DueDate = dto.DueDate ?? DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };
        _context.WorkAllocations.Add(report);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<WorkAllocation> { Success = true, Data = report });
    }
}

public class CreateReportDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? WorkId { get; set; }
    public string? Priority { get; set; }
    public string? Status { get; set; }
    public DateTime? DueDate { get; set; }
}
