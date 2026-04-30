using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;
using System.Security.Claims;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("tasks")]
public class TasksController : ControllerBase
{
    private readonly AppDbContext _context;

    public TasksController(AppDbContext context) => _context = context;

    private int CurrentUserId => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
    private int CurrentAssocId => int.TryParse(User.FindFirst("AssociationId")?.Value, out var id) ? id : 0;
    private bool IsSuperAdmin => User.IsInRole("super_admin");

    // GET /tasks — admin sees all tasks for their association; staff sees assigned tasks
    [HttpGet]
    public async Task<ActionResult> GetAll([FromQuery] int? adminId, [FromQuery] int? assignedTo)
    {
        var query = _context.StaffTasks
            .Where(t => t.AssociationId == CurrentAssocId)
            .AsQueryable();

        if (adminId.HasValue)
            query = query.Where(t => t.AssignedBy == adminId.Value);

        if (assignedTo.HasValue)
            query = query.Where(t => t.AssignedTo == assignedTo.Value);

        var tasks = await query.OrderByDescending(t => t.CreatedAt).ToListAsync();

        // Auto-reset recurring tasks
        var now = DateTime.UtcNow;
        var todayStart = now.Date;
        var thisMonthStart = new DateTime(now.Year, now.Month, 1);
        bool anyReset = false;

        foreach (var task in tasks)
        {
            if (task.RecurrenceType == "daily" && task.Status == "completed" && task.CompletedAt.HasValue
                && task.CompletedAt.Value.Date < todayStart)
            {
                task.Status = "pending";
                task.CompletedAt = null;
                task.DueDate = new DateTime(todayStart.Year, todayStart.Month, todayStart.Day,
                    task.DueDate.Hour, task.DueDate.Minute, 0, DateTimeKind.Utc);
                anyReset = true;
            }
            if (task.RecurrenceType == "monthly" && task.Status == "completed" && task.CompletedAt.HasValue)
            {
                var completedMonth = new DateTime(task.CompletedAt.Value.Year, task.CompletedAt.Value.Month, 1);
                if (completedMonth < thisMonthStart)
                {
                    task.Status = "pending";
                    task.CompletedAt = null;
                    task.DueDate = new DateTime(now.Year, now.Month,
                        DateTime.DaysInMonth(now.Year, now.Month), 23, 59, 59, DateTimeKind.Utc);
                    anyReset = true;
                }
            }
        }

        if (anyReset)
            await _context.SaveChangesAsync();

        return Ok(new ApiResponse<List<StaffTask>> { Success = true, Data = tasks });
    }

    // GET /tasks/my-tasks — tasks assigned to the current user
    // Auto-resets recurring tasks: daily tasks reset each day, monthly tasks reset each month
    [HttpGet("my-tasks")]
    public async Task<ActionResult> GetMyTasks()
    {
        var now = DateTime.UtcNow;
        var todayStart = now.Date;
        var thisMonthStart = new DateTime(now.Year, now.Month, 1);

        var tasks = await _context.StaffTasks
            .Where(t => t.AssignedTo == CurrentUserId)
            .OrderBy(t => t.DueDate)
            .ToListAsync();

        bool anyReset = false;

        foreach (var task in tasks)
        {
            // Daily recurring tasks: reset to pending each new day
            if (task.RecurrenceType == "daily" && task.Status == "completed" && task.CompletedAt.HasValue)
            {
                if (task.CompletedAt.Value.Date < todayStart)
                {
                    task.Status = "pending";
                    task.CompletedAt = null;
                    // Advance DueDate to today
                    task.DueDate = new DateTime(todayStart.Year, todayStart.Month, todayStart.Day,
                        task.DueDate.Hour, task.DueDate.Minute, 0, DateTimeKind.Utc);
                    anyReset = true;
                }
            }

            // Monthly recurring tasks: reset to pending each new month
            if (task.RecurrenceType == "monthly" && task.Status == "completed" && task.CompletedAt.HasValue)
            {
                var completedMonth = new DateTime(task.CompletedAt.Value.Year, task.CompletedAt.Value.Month, 1);
                if (completedMonth < thisMonthStart)
                {
                    task.Status = "pending";
                    task.CompletedAt = null;
                    // Advance DueDate to end of current month
                    var endOfMonth = new DateTime(now.Year, now.Month,
                        DateTime.DaysInMonth(now.Year, now.Month), 23, 59, 59, DateTimeKind.Utc);
                    task.DueDate = endOfMonth;
                    anyReset = true;
                }
            }
        }

        if (anyReset)
            await _context.SaveChangesAsync();

        return Ok(new ApiResponse<List<StaffTask>> { Success = true, Data = tasks });
    }

    // GET /tasks/reminders — pending/overdue tasks due within 3 days
    [HttpGet("reminders")]
    public async Task<ActionResult> GetReminders()
    {
        var cutoff = DateTime.UtcNow.AddDays(3);
        var tasks = await _context.StaffTasks
            .Where(t => t.AssignedTo == CurrentUserId
                     && t.Status != "completed"
                     && t.DueDate <= cutoff)
            .OrderBy(t => t.DueDate)
            .ToListAsync();

        return Ok(new ApiResponse<List<StaffTask>> { Success = true, Data = tasks });
    }

    // GET /tasks/performance — completion stats per user for the association
    [HttpGet("performance")]
    public async Task<ActionResult> GetPerformance()
    {
        var stats = await _context.StaffTasks
            .Where(t => t.AssociationId == CurrentAssocId)
            .GroupBy(t => t.AssignedTo)
            .Select(g => new
            {
                UserId = g.Key,
                Total = g.Count(),
                Completed = g.Count(t => t.Status == "completed"),
                Pending = g.Count(t => t.Status == "pending"),
                InProgress = g.Count(t => t.Status == "in_progress")
            })
            .ToListAsync();

        return Ok(new ApiResponse<object> { Success = true, Data = stats });
    }

    // GET /tasks/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult> GetById(int id)
    {
        var task = await _context.StaffTasks.FindAsync(id);
        if (task == null)
            return NotFound(new ApiResponse { Success = false, Message = "Task not found" });

        return Ok(new ApiResponse<StaffTask> { Success = true, Data = task });
    }

    // POST /tasks
    [Authorize(Roles = "super_admin,admin,sub_admin,property_manager")]
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] TaskDto dto)
    {
        var task = new StaffTask
        {
            AssociationId = CurrentAssocId,
            AssignedTo = dto.AssignedTo,
            AssignedBy = CurrentUserId,
            TaskName = dto.TaskName,
            Description = dto.Description,
            Priority = dto.Priority ?? "medium",
            Status = "pending",
            IsRecurring = dto.IsRecurring ?? false,
            RecurrenceType = dto.RecurrenceType,   // 'daily' | 'monthly' | null
            DueDate = dto.DueDate,
            CreatedAt = DateTime.UtcNow,
            IsDeleted = true
        };

        _context.StaffTasks.Add(task);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<StaffTask> { Success = true, Data = task });
    }

    // PUT /tasks/{id}
    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] TaskDto dto)
    {
        var task = await _context.StaffTasks.FindAsync(id);
        if (task == null)
            return NotFound(new ApiResponse { Success = false, Message = "Task not found" });

        task.TaskName = dto.TaskName ?? task.TaskName;
        task.Description = dto.Description ?? task.Description;
        task.Priority = dto.Priority ?? task.Priority;
        task.DueDate = dto.DueDate != default ? dto.DueDate : task.DueDate;
        task.IsRecurring = dto.IsRecurring ?? task.IsRecurring;

        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<StaffTask> { Success = true, Data = task });
    }

    // PATCH /tasks/{id}/status
    [HttpPatch("{id}/status")]
    public async Task<ActionResult> UpdateStatus(int id, [FromBody] StatusUpdateDto dto)
    {
        var task = await _context.StaffTasks.FindAsync(id);
        if (task == null)
            return NotFound(new ApiResponse { Success = false, Message = "Task not found" });

        task.Status = dto.Status;
        if (dto.Status == "completed")
            task.CompletedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<StaffTask> { Success = true, Data = task });
    }

    // DELETE /tasks/{id}
    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        var task = await _context.StaffTasks.FindAsync(id);
        if (task == null)
            return NotFound(new ApiResponse { Success = false, Message = "Task not found" });

        _context.StaffTasks.Remove(task);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Task deleted" });
    }

    // POST /tasks/{id}/attachments — DISABLED: AttachmentUrls column not in production DB
    // [HttpPost("{id}/attachments")]
    // public async Task<ActionResult> UploadAttachments(int id, [FromBody] TaskAttachmentDto dto)
    // {
    //     var task = await _context.StaffTasks.FindAsync(id);
    //     if (task == null)
    //         return NotFound(new ApiResponse { Success = false, Message = "Task not found" });
    //     task.AttachmentUrls = System.Text.Json.JsonSerializer.Serialize(dto.Files);
    //     await _context.SaveChangesAsync();
    //     return Ok(new ApiResponse<StaffTask> { Success = true, Data = task });
    // }

    // POST /tasks/bulk — bulk create tasks for multiple employees
    [Authorize(Roles = "super_admin,admin,sub_admin,property_manager")]
    [HttpPost("bulk")]
    public async Task<ActionResult> BulkCreate([FromBody] BulkTaskDto dto)
    {
        if (dto.Tasks == null || !dto.Tasks.Any())
            return BadRequest(new ApiResponse { Success = false, Message = "No tasks provided" });

        var tasks = dto.Tasks.Select(t => new StaffTask
        {
            AssociationId = CurrentAssocId,
            AssignedTo = t.AssignedTo,
            AssignedBy = CurrentUserId,
            TaskName = t.TaskName,
            Description = t.Description,
            Priority = t.Priority ?? "medium",
            Status = "pending",
            IsRecurring = t.IsRecurring ?? false,
            DueDate = t.DueDate,
            CreatedAt = DateTime.UtcNow,
            IsDeleted = true
        }).ToList();

        _context.StaffTasks.AddRange(tasks);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<List<StaffTask>> { Success = true, Data = tasks });
    }
}

public record TaskDto(
    int AssignedTo,
    string TaskName,
    string? Description,
    string? Priority,
    DateTime DueDate,
    bool? IsRecurring,
    string? RecurrenceType
);

public record StatusUpdateDto(string Status);

// DISABLED: AttachmentUrls feature until production DB is updated
// public class TaskAttachmentDto
// {
//     public List<TaskFileDto> Files { get; set; } = new();
// }
// public class TaskFileDto
// {
//     public string Name { get; set; } = string.Empty;
//     public string Type { get; set; } = string.Empty;
//     public string Data { get; set; } = string.Empty;
// }

public class BulkTaskDto
{
    public List<TaskDto> Tasks { get; set; } = new();
}
