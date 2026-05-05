using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Attributes;
using SkycityBackend.Data;
using SkycityBackend.DTOs;
using SkycityBackend.Models;
using SkycityBackend.Services;
using System.Security.Claims;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("workallocations")]
public class WorkAllocationController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;
    private readonly INotificationService _notifications;

    public WorkAllocationController(AppDbContext context, IWebHostEnvironment env, INotificationService notifications)
    {
        _context = context;
        _env = env;
        _notifications = notifications;
    }

    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    private int CurrentAssocId => int.TryParse(User.FindFirst("AssociationId")?.Value, out var id) ? id : 0;

    /// <summary>Returns all admin/sub_admin/property_manager user IDs for the current association.</summary>
    private async Task<List<int>> GetAdminIdsAsync()
    {
        var adminRoles = new[] { "admin", "sub_admin", "property_manager", "facility_manager" };
        return await _context.Users
            .AsNoTracking()
            .Where(u => u.AssociationId == CurrentAssocId && u.IsActive && adminRoles.Contains(u.Role.ToString()))
            .Select(u => u.Id)
            .ToListAsync();
    }

    private async Task NotifyAdminsAsync(string title, string message, string type, int referenceId)
    {
        var adminIds = await GetAdminIdsAsync();
        if (adminIds.Count > 0)
            await _notifications.SendBulkAsync(adminIds, title, message, type, referenceId);
    }

    [HttpGet("all")]
    public async Task<ActionResult> GetAll()
    {
        var items = await _context.WorkAllocations
            .Where(a => a.AssociationId == CurrentAssocId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        var userIds = items.SelectMany(a => new[] { a.AssignedTo, a.AssignedBy }).Distinct().ToList();
        var users = await _context.Users
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FullName })
            .ToListAsync();
        var userMap = users.ToDictionary(u => u.Id, u => u.FullName);

        var workIds = items.Select(a => a.WorkId).Distinct().ToList();
        var works = await _context.WorkCategories
            .Where(w => workIds.Contains(w.Id))
            .Select(w => new { w.Id, w.WorkTitle })
            .ToListAsync();
        var workMap = works.ToDictionary(w => w.Id, w => w.WorkTitle);

        var enriched = items.Select(a => new
        {
            a.Id, a.Title, a.Description, a.WorkId, a.AssignedTo, a.AssignedBy,
            a.AssociationId, a.Priority, a.Status, a.DueDate,
            a.ProgressNote, a.RequestStatus, a.RequestedDueDate, a.RequestedDescription,
            a.ReassignReason, a.ReassignedFrom, a.CreatedAt, a.Duration, a.CompletedAt,
            a.AttachmentUrls,
            clientName = userMap.GetValueOrDefault(a.AssignedTo, ""),
            workTitle = !string.IsNullOrEmpty(workMap.GetValueOrDefault(a.WorkId, ""))
                ? workMap[a.WorkId]
                : (!string.IsNullOrEmpty(a.Title) ? a.Title : null),
            lastProgressUpdate = a.ProgressNote != null ? a.CreatedAt : (DateTime?)null,
        });

        return Ok(new ApiResponse<dynamic> { Success = true, Data = enriched });
    }

    [HttpGet("my-tasks")]
    public async Task<ActionResult> GetMyTasks()
    {
        var items = await _context.WorkAllocations
            .Where(a => a.AssignedTo == CurrentUserId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();

        var workIds = items.Select(a => a.WorkId).Distinct().ToList();
        var works = await _context.WorkCategories
            .Where(w => workIds.Contains(w.Id))
            .Select(w => new { w.Id, w.WorkTitle })
            .ToListAsync();
        var workMap = works.ToDictionary(w => w.Id, w => w.WorkTitle);

        var enriched = items.Select(a => new
        {
            a.Id, a.Title, a.Description, a.WorkId, a.AssignedTo, a.AssignedBy,
            a.AssociationId, a.Priority, a.Status, a.DueDate,
            a.ProgressNote, a.RequestStatus, a.RequestedDueDate, a.RequestedDescription,
            a.ReassignReason, a.ReassignedFrom, a.CreatedAt, a.Duration, a.CompletedAt,
            a.AttachmentUrls,
            workTitle = !string.IsNullOrEmpty(workMap.GetValueOrDefault(a.WorkId, ""))
                ? workMap[a.WorkId]
                : (!string.IsNullOrEmpty(a.Title) ? a.Title : null),
        });

        return Ok(new ApiResponse<dynamic> { Success = true, Data = enriched });
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

        // Notify admins
        var employee = await _context.Users.AsNoTracking().Where(u => u.Id == CurrentUserId).Select(u => u.FullName).FirstOrDefaultAsync() ?? "An employee";
        await NotifyAdminsAsync(
            "New Self-Assigned Work",
            $"{employee} self-assigned: \"{dto.Title}\"",
            "self_assign",
            alloc.Id
        );

        return Ok(new ApiResponse<dynamic> { Success = true, Message = "Work started and admin notified", Data = alloc });
    }

    [RequirePermission("work_orders", "create")]
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateAllocationDto dto)
    {
        var allocations = new List<WorkAllocation>();
        var dupeSkipped = new List<int>();

        // Load existing allocations for this association to check duplicates in memory
        var dueDateDay = dto.DueDate.Date;
        var existingTitles = await _context.WorkAllocations
            .Where(a => a.AssociationId == CurrentAssocId
                     && a.Title.ToLower() == dto.Title.ToLower().Trim()
                     && dto.AssignedToIds.Contains(a.AssignedTo))
            .Select(a => new { a.AssignedTo, DueDateDay = a.DueDate.Date })
            .ToListAsync();

        foreach (var userId in dto.AssignedToIds)
        {
            // Skip if same title + same user + same due date already exists
            bool isDupe = existingTitles.Any(e =>
                e.AssignedTo == userId &&
                e.DueDateDay == dueDateDay);

            if (isDupe)
            {
                dupeSkipped.Add(userId);
                continue;
            }

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

        if (allocations.Count > 0)
        {
            _context.WorkAllocations.AddRange(allocations);
            await _context.SaveChangesAsync();
        }

        return Ok(new ApiResponse<dynamic>
        {
            Success = true,
            Data = new
            {
                allocations,
                created = allocations.Count,
                skipped = dupeSkipped.Count,
                message = dupeSkipped.Count > 0
                    ? $"{dupeSkipped.Count} duplicate(s) skipped — same task already assigned to those users on that date."
                    : null
            }
        });
    }

    // PUT /workallocations/{id} — update title, description, priority, dueDate
    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] UpdateAllocationDto dto)
    {
        var alloc = await _context.WorkAllocations.FindAsync(id);
        if (alloc == null)
            return NotFound(new ApiResponse { Success = false, Message = "Not found" });

        if (dto.Title != null) alloc.Title = dto.Title;
        if (dto.Description != null) alloc.Description = dto.Description;
        if (dto.Priority != null) alloc.Priority = dto.Priority;
        if (dto.DueDate.HasValue) alloc.DueDate = dto.DueDate.Value;

        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<WorkAllocation> { Success = true, Data = alloc });
    }

    [HttpPost("{id}/status")]
    public async Task<ActionResult> UpdateStatus(int id, [FromBody] UpdateStatusDto dto)
    {
        var alloc = await _context.WorkAllocations.FindAsync(id);
        if (alloc == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        var prevStatus = alloc.Status;
        alloc.Status = dto.Status;
        if (!string.IsNullOrEmpty(dto.Duration))
            alloc.Duration = dto.Duration;
        if (dto.Status == "completed")
            alloc.CompletedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // Notify admins when employee starts or completes a task
        if (dto.Status == "in-progress" && prevStatus != "in-progress")
        {
            var employee = await _context.Users.AsNoTracking().Where(u => u.Id == CurrentUserId).Select(u => u.FullName).FirstOrDefaultAsync() ?? "An employee";
            await NotifyAdminsAsync(
                "Task Started",
                $"{employee} started working on \"{alloc.Title}\"",
                "task_started",
                alloc.Id
            );
        }
        else if (dto.Status == "completed")
        {
            var employee = await _context.Users.AsNoTracking().Where(u => u.Id == CurrentUserId).Select(u => u.FullName).FirstOrDefaultAsync() ?? "An employee";
            var durationText = !string.IsNullOrEmpty(dto.Duration) ? $" (Duration: {dto.Duration})" : "";
            await NotifyAdminsAsync(
                "Task Completed ✅",
                $"{employee} completed \"{alloc.Title}\"{durationText}",
                "task_completed",
                alloc.Id
            );
        }

        return Ok(new ApiResponse { Success = true, Message = "Status updated" });
    }

    [HttpPost("{id}/progress")]
    public async Task<ActionResult> UpdateProgress(int id, [FromBody] ProgressDto dto)
    {
        var alloc = await _context.WorkAllocations.FindAsync(id);
        if (alloc == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        alloc.ProgressNote = dto.ProgressNote;
        await _context.SaveChangesAsync();

        // Notify admins of progress update
        var employee = await _context.Users.AsNoTracking().Where(u => u.Id == CurrentUserId).Select(u => u.FullName).FirstOrDefaultAsync() ?? "An employee";
        await NotifyAdminsAsync(
            "Progress Update 📝",
            $"{employee} updated progress on \"{alloc.Title}\": {dto.ProgressNote}",
            "progress_update",
            alloc.Id
        );

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

    [HttpPost("{id}/attachments-base64")]
    public async Task<ActionResult> UploadAttachmentsBase64(int id, [FromBody] Base64AttachmentsDto dto)
    {
        var alloc = await _context.WorkAllocations.FindAsync(id);
        if (alloc == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        if (dto.Files == null || dto.Files.Count == 0)
            return BadRequest(new ApiResponse { Success = false, Message = "No files provided" });

        var existing = string.IsNullOrEmpty(alloc.AttachmentUrls) ? "[]" : alloc.AttachmentUrls;
        if (!existing.TrimStart().StartsWith("["))
            existing = "[]";

        var existingList = System.Text.Json.JsonSerializer.Deserialize<List<System.Text.Json.JsonElement>>(existing) ?? new();
        var newItems = dto.Files.Select(f => new { f.Name, f.Type, f.Data }).ToList();
        var combined = existingList.Select(e => (object)e).Concat(newItems.Select(n => (object)n)).ToList();
        alloc.AttachmentUrls = System.Text.Json.JsonSerializer.Serialize(combined);

        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<dynamic> { Success = true, Data = new { count = dto.Files.Count, attachmentUrls = alloc.AttachmentUrls } });
    }

    [HttpPost("{id}/attachments")]
    public async Task<ActionResult> UploadAttachments(int id, [FromForm] List<IFormFile> files)
    {
        var alloc = await _context.WorkAllocations.FindAsync(id);
        if (alloc == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        if (files == null || files.Count == 0)
            return BadRequest(new ApiResponse { Success = false, Message = "No files provided" });

        var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
        var uploadDir = Path.Combine(webRoot, "uploads", "allocations");
        Directory.CreateDirectory(uploadDir);

        var urls = new List<string>();
        foreach (var file in files)
        {
            if (file.Length == 0) continue;
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var allowed = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".doc", ".docx" };
            if (!allowed.Contains(ext)) continue;
            var fileName = $"{Guid.NewGuid()}{ext}";
            var filePath = Path.Combine(uploadDir, fileName);
            using var stream = new FileStream(filePath, FileMode.Create);
            await file.CopyToAsync(stream);
            urls.Add($"/uploads/allocations/{fileName}");
        }

        if (urls.Count == 0)
            return BadRequest(new ApiResponse { Success = false, Message = "No valid files uploaded" });

        var existing = string.IsNullOrEmpty(alloc.AttachmentUrls)
            ? new List<string>()
            : alloc.AttachmentUrls.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
        existing.AddRange(urls);
        alloc.AttachmentUrls = string.Join(",", existing);

        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<dynamic> { Success = true, Data = new { urls, allAttachments = alloc.AttachmentUrls } });
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

    [HttpPost("{id}/request-change")]
    public async Task<ActionResult> RequestChange(int id, [FromBody] RequestChangeDto dto)
    {
        var alloc = await _context.WorkAllocations.FindAsync(id);
        if (alloc == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        alloc.RequestStatus = "pending";
        alloc.RequestedDueDate = dto.DueDate;
        alloc.RequestedDescription = dto.Description;
        await _context.SaveChangesAsync();

        // Notify admins of the change request
        var employee = await _context.Users.AsNoTracking().Where(u => u.Id == CurrentUserId).Select(u => u.FullName).FirstOrDefaultAsync() ?? "An employee";
        await NotifyAdminsAsync(
            "Update Request ⚠️",
            $"{employee} requested changes on \"{alloc.Title}\"",
            "request_change",
            alloc.Id
        );

        return Ok(new ApiResponse { Success = true, Message = "Request submitted" });
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

        var newDate = alloc.DueDate.ToString("MMM dd, yyyy");
        await _notifications.SendAsync(
            alloc.AssignedTo,
            "✅ Request Approved",
            $"Your due date extension request for \"{alloc.Title}\" has been approved. New due date: {newDate}.",
            "request_approved",
            alloc.Id
        );

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

        await _notifications.SendAsync(
            alloc.AssignedTo,
            "❌ Request Rejected",
            $"Your due date extension request for \"{alloc.Title}\" was not approved. The original due date remains.",
            "request_rejected",
            alloc.Id
        );

        return Ok(new ApiResponse { Success = true, Message = "Request denied" });
    }

    [RequirePermission("work_orders", "create")]
    [HttpPost("bulk")]
    public async Task<ActionResult> BulkCreate([FromBody] List<BulkAllocationRowDto> rows)
    {
        if (rows == null || rows.Count == 0)
            return BadRequest(new ApiResponse { Success = false, Message = "No allocation rows provided." });

        // Use a longer timeout for the entire bulk operation on slow connections
        _context.Database.SetCommandTimeout(120);

        var workCategories = await _context.WorkCategories.AsNoTracking().Where(w => w.IsActive).ToListAsync();
        var assocUsers = await _context.Users.AsNoTracking().Where(u => u.AssociationId == CurrentAssocId && u.IsActive).ToListAsync();
        var validPriorities = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "low", "medium", "high" };
        var acceptedDateFormats = new[] { "yyyy-MM-dd", "yyyy-MM-ddTHH:mm:ssZ", "dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-ddTHH:mm:ss" };

        var created = new List<WorkAllocation>();
        var errors = new List<string>();

        // Load existing allocations once for duplicate checking
        var existingAllocs = await _context.WorkAllocations
            .Where(a => a.AssociationId == CurrentAssocId)
            .Select(a => new { a.Title, a.AssignedTo, DueDateDay = a.DueDate.Date })
            .ToListAsync();

        // Track what we're about to insert this batch to catch intra-batch dupes
        var batchKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        for (int i = 0; i < rows.Count; i++)
        {
            var row = rows[i];
            int rowNum = i + 1;

            if (string.IsNullOrWhiteSpace(row.Title))
            {
                errors.Add($"Row {rowNum}: Title is required.");
                continue;
            }

            WorkCategory? work = null;
            if (!string.IsNullOrWhiteSpace(row.WorkCode))
                work = workCategories.FirstOrDefault(w => string.Equals(w.WorkCode, row.WorkCode.Trim(), StringComparison.OrdinalIgnoreCase));
            if (work == null && !string.IsNullOrWhiteSpace(row.WorkTitle))
                work = workCategories.FirstOrDefault(w => string.Equals(w.WorkTitle, row.WorkTitle.Trim(), StringComparison.OrdinalIgnoreCase));
            // workCode/workTitle are optional — if not matched, WorkId defaults to 0 (no category)
            int resolvedWorkId = work?.Id ?? 0;

            User? assignedUser = null;
            if (!string.IsNullOrWhiteSpace(row.AssignedTo))
            {
                assignedUser = assocUsers.FirstOrDefault(u => string.Equals(u.Username, row.AssignedTo.Trim(), StringComparison.OrdinalIgnoreCase))
                            ?? assocUsers.FirstOrDefault(u => string.Equals(u.FullName, row.AssignedTo.Trim(), StringComparison.OrdinalIgnoreCase));
            }
            if (assignedUser == null)
            {
                errors.Add($"Row {rowNum}: Could not find active user '{row.AssignedTo}'.");
                continue;
            }

            if (!DateTime.TryParseExact(row.DueDate?.Trim(), acceptedDateFormats,
                    System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.AssumeUniversal | System.Globalization.DateTimeStyles.AdjustToUniversal,
                    out var dueDate))
            {
                errors.Add($"Row {rowNum}: Invalid date format '{row.DueDate}'.");
                continue;
            }

            var priority = "medium";
            if (!string.IsNullOrWhiteSpace(row.Priority) && validPriorities.Contains(row.Priority.Trim()))
                priority = row.Priority.Trim().ToLower();

            // Duplicate check: same title + same user + same due date (existing DB or this batch)
            var dupeKey = $"{row.Title.Trim().ToLower()}|{assignedUser.Id}|{dueDate.Date:yyyy-MM-dd}";
            bool isDupe = batchKeys.Contains(dupeKey) ||
                          existingAllocs.Any(e =>
                              string.Equals(e.Title, row.Title.Trim(), StringComparison.OrdinalIgnoreCase) &&
                              e.AssignedTo == assignedUser.Id &&
                              e.DueDateDay == dueDate.Date);

            if (isDupe)
            {
                errors.Add($"Row {rowNum}: Duplicate — '{row.Title.Trim()}' is already assigned to '{assignedUser.FullName}' on {dueDate:yyyy-MM-dd}.");
                continue;
            }

            batchKeys.Add(dupeKey);

            created.Add(new WorkAllocation
            {
                Title = row.Title.Trim(),
                Description = string.IsNullOrWhiteSpace(row.Description) ? null : row.Description.Trim(),
                WorkId = resolvedWorkId,
                AssignedTo = assignedUser.Id,
                AssignedBy = CurrentUserId,
                AssociationId = CurrentAssocId,
                Priority = priority,
                Status = "pending",
                DueDate = dueDate,
                CreatedAt = DateTime.UtcNow
            });
        }

        if (created.Count > 0)
        {
            _context.WorkAllocations.AddRange(created);
            await _context.SaveChangesAsync();
        }

        return Ok(new ApiResponse<dynamic>
        {
            Success = true,
            Data = new { created = created.Count, failed = errors.Count, errors }
        });
    }

    [HttpPost("{id}/delete-attachments")]
    public async Task<ActionResult> DeleteAttachments(int id, [FromBody] DeleteAttachmentsDto? dto = null)
    {
        var alloc = await _context.WorkAllocations.FindAsync(id);
        if (alloc == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });

        if (string.IsNullOrEmpty(alloc.AttachmentUrls))
            return Ok(new ApiResponse { Success = true, Message = "No attachments to delete" });

        if (dto?.AttachmentName != null)
        {
            try
            {
                var attachments = System.Text.Json.JsonSerializer.Deserialize<List<System.Text.Json.JsonElement>>(alloc.AttachmentUrls);
                if (attachments != null)
                {
                    var filtered = attachments.Where(a =>
                    {
                        if (a.TryGetProperty("name", out var nameEl) || a.TryGetProperty("Name", out nameEl))
                            return nameEl.GetString() != dto.AttachmentName;
                        return true;
                    }).ToList();
                    alloc.AttachmentUrls = filtered.Count > 0 ? System.Text.Json.JsonSerializer.Serialize(filtered) : null;
                }
                else
                {
                    var paths = alloc.AttachmentUrls.Split(',', StringSplitOptions.RemoveEmptyEntries)
                        .Where(p => !p.Contains(dto.AttachmentName)).ToList();
                    alloc.AttachmentUrls = paths.Count > 0 ? string.Join(",", paths) : null;
                }
            }
            catch
            {
                var paths = alloc.AttachmentUrls.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Where(p => !p.Contains(dto.AttachmentName)).ToList();
                alloc.AttachmentUrls = paths.Count > 0 ? string.Join(",", paths) : null;
            }
        }
        else
        {
            alloc.AttachmentUrls = null;
        }

        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<dynamic> { Success = true, Message = "Attachments deleted successfully", Data = new { attachmentUrls = alloc.AttachmentUrls } });
    }
}
