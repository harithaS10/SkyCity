using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.DTOs;
using SkycityBackend.Models;
using SkycityBackend.Services;
using System.Security.Claims;

using SkycityBackend.Attributes;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("complaints")]
public class ComplaintsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;
    private readonly INotificationService _notificationService;

    public ComplaintsController(
        AppDbContext context, 
        IAuditService auditService,
        INotificationService notificationService)
    {
        _context = context;
        _auditService = auditService;
        _notificationService = notificationService;
    }

    [HttpGet]
    public async Task<ActionResult> GetComplaints(
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var assocIdStr = User.FindFirst("AssociationId")?.Value;
        int.TryParse(userIdStr, out var userId);
        int.TryParse(assocIdStr, out var assocId);
        var isSuperAdmin = User.IsInRole("super_admin");
        var isAdmin = User.IsInRole("admin") || User.IsInRole("sub_admin") || User.IsInRole("property_manager") || User.IsInRole("helpdesk");

        // Use lightweight projection — no deep Include chains to avoid timeout
        var query = _context.Complaints.AsNoTracking().AsQueryable();

        if (!isSuperAdmin && assocId > 0)
            query = query.Where(c => c.Resident!.AssociationId == assocId);

        if (!isSuperAdmin && !isAdmin && userId > 0)
            query = query.Where(c => c.ResidentId == userId || c.AssignedTo == userId);

        if (!string.IsNullOrEmpty(status))
            query = query.Where(c => c.Status == status);

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                c.Id,
                c.ComplaintNumber,
                c.Title,
                c.Description,
                c.Priority,
                c.Status,
                c.ResidentId,
                c.AssignedTo,
                c.AssignedBy,
                c.AssignedAt,
                c.Resolution,
                c.Rating,
                c.Feedback,
                c.CreatedAt,
                c.ResolvedAt,
                c.ClosedAt,
                ResidentName = c.Resident != null ? c.Resident.FullName : null,
                CategoryName = c.Category != null ? c.Category.CategoryName : null,
                UnitNumber = c.Unit != null ? c.Unit.UnitNumber : null,
            })
            .ToListAsync();

        return Ok(new ApiResponse<dynamic>
        {
            Success = true,
            Data = new
            {
                Total = total,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling(total / (double)pageSize),
                Items = items
            }
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult> GetComplaint(int id)
    {
        var complaint = await _context.Complaints
            .Include(c => c.Resident)
            .Include(c => c.Category)
            .Include(c => c.Unit)
            .ThenInclude(u => u!.Building)
            .ThenInclude(b => b!.Property)
            .Include(c => c.AssignedStaff)
            .FirstOrDefaultAsync(c => c.Id == id);
        
        if (complaint == null)
            return NotFound(new ApiResponse { Success = false, Message = "Complaint not found" });
            
        return Ok(new ApiResponse<Complaint> { Data = complaint });
    }

    [Authorize(Roles = "resident,staff,helpdesk,property_manager,admin,sub_admin")]
    [HttpPost]
    public async Task<ActionResult> CreateComplaint([FromBody] CreateComplaintDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(new ApiResponse { Success = false, Message = "Invalid input" });
        
        var complaint = new Complaint
        {
            ResidentId = dto.ResidentId,
            UnitId = dto.UnitId > 0 ? dto.UnitId : null,
            CategoryId = null, // FK to ComplaintCategories — set null since we use work types now
            Title = dto.Title,
            Description = dto.Description,
            Priority = dto.Priority,
            ComplaintNumber = $"CMP-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}",
            Status = "Open",
            CreatedAt = DateTime.UtcNow,
            IsDeleted = true,
        };

        // Store work type reference in description prefix if provided
        if (dto.CategoryId > 0)
        {
            var workType = await _context.WorkCategories.FindAsync(dto.CategoryId);
            if (workType != null && !complaint.Title.Contains(workType.WorkTitle))
                complaint.Description = $"[{workType.WorkTitle}] {complaint.Description}".Trim();
        }

        _context.Complaints.Add(complaint);
        await _context.SaveChangesAsync();
        
        await _auditService.LogChangeAsync<Complaint>("Create", "Complaint", complaint);
        
        return Ok(new ApiResponse<Complaint> { Success = true, Data = complaint });
    }

    [Authorize(Roles = "helpdesk,property_manager,admin,sub_admin,facility_manager,staff")]
    [HttpPatch("{id}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateComplaintStatusDto dto)
    {
        var complaint = await _context.Complaints.FindAsync(id);
        if (complaint == null)
            return NotFound(new ApiResponse { Success = false, Message = "Not Found" });

        complaint.Status = dto.Status;
        await _context.SaveChangesAsync();
        await _auditService.LogChangeAsync<Complaint>("StatusUpdate", "Complaint", complaint);
        return Ok(new ApiResponse { Success = true, Message = $"Status updated to {dto.Status}" });
    }

    [Authorize(Roles = "helpdesk,property_manager,admin,sub_admin,facility_manager")]
    [HttpPost("{id}/assign")]
    public async Task<IActionResult> AssignComplaint(int id, [FromBody] AssignmentDto dto)
    {
        var complaint = await _context.Complaints
            .Include(c => c.Category)
            .FirstOrDefaultAsync(c => c.Id == id);
            
        if (complaint == null)
            return NotFound(new ApiResponse { Success = false, Message = "Not Found" });
        
        var oldComplaint = new { complaint.Status, complaint.AssignedTo };
        
        complaint.AssignedTo = dto.StaffId;
        complaint.AssignedBy = dto.ManagerId ?? int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
        complaint.AssignedAt = DateTime.UtcNow;
        complaint.Status = "Assigned";
        
        await _context.SaveChangesAsync();
        
        // Audit log
        await _auditService.LogChangeAsync<Complaint>("Assign", "Complaint", complaint);
        
        // Notify staff
        await _notificationService.SendAsync(
            dto.StaffId,
            "Complaint Assigned",
            $"Complaint #{complaint.ComplaintNumber} has been assigned to you",
            "complaint_assigned",
            complaint.Id);
        
        return Ok(new ApiResponse { Message = "Assigned successfully" });
    }

    [Authorize(Roles = "staff,vendor,property_manager,admin")]
    [HttpPost("{id}/resolve")]
    public async Task<IActionResult> ResolveComplaint(int id, [FromBody] ResolutionDto dto)
    {
        var complaint = await _context.Complaints.FindAsync(id);
        if (complaint == null)
            return NotFound(new ApiResponse { Success = false, Message = "Not Found" });
        
        var oldComplaint = new { complaint.Status, complaint.Resolution };
        
        complaint.Status = "Resolved";
        complaint.Resolution = dto.Resolution;
        complaint.ResolutionNotes = dto.Notes;
        complaint.ResolvedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync();
        
        // Audit log
        await _auditService.LogChangeAsync<Complaint>("Resolve", "Complaint", complaint);
        
        // Notify resident for feedback
        await _notificationService.SendAsync(
            complaint.ResidentId,
            "Complaint Resolved",
            $"Complaint #{complaint.ComplaintNumber} has been resolved. Please provide your feedback.",
            "complaint_resolved",
            complaint.Id);
        
        return Ok(new ApiResponse { Message = "Resolved successfully" });
    }

    [Authorize(Roles = "resident")]
    [HttpPost("{id}/feedback")]
    public async Task<IActionResult> SubmitFeedback(int id, [FromBody] FeedbackDto dto)
    {
        var complaint = await _context.Complaints.FindAsync(id);
        if (complaint == null)
            return NotFound(new ApiResponse { Success = false, Message = "Not Found" });
        
        var oldState = new { complaint.Rating, complaint.Feedback, complaint.Status };
        
        complaint.Rating = dto.Rating;
        complaint.Feedback = dto.Feedback;
        complaint.Status = "Closed";
        complaint.ClosedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync();
        
        // Audit log
        await _auditService.LogChangeAsync<Complaint>("Feedback", "Complaint", complaint);
        
        // Notify manager
        if (complaint.AssignedBy.HasValue)
        {
            await _notificationService.SendAsync(
                complaint.AssignedBy.Value,
                "Feedback Received",
                $"Complaint #{complaint.ComplaintNumber} received rating {dto.Rating}/5",
                "feedback_received",
                complaint.Id);
        }
        
        return Ok(new ApiResponse { Message = "Feedback submitted successfully" });
    }
}
