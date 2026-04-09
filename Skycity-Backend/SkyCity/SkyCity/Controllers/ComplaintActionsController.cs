using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.DTOs;
using SkycityBackend.Models;
using SkycityBackend.Services;
using System.Security.Claims;

namespace SkycityBackend.Controllers;

/// <summary>
/// Separate controller for complaint actions (assign, status update).
/// Route: /complaint-actions — avoids conflicts with the existing deployed /complaints controller.
/// </summary>
[Authorize]
[ApiController]
[Route("complaint-actions")]
public class ComplaintActionsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;
    private readonly INotificationService _notificationService;

    public ComplaintActionsController(AppDbContext context, IAuditService auditService, INotificationService notificationService)
    {
        _context = context;
        _auditService = auditService;
        _notificationService = notificationService;
    }

    // POST /complaint-actions/{id}/assign
    [HttpPost("{id}/assign")]
    public async Task<IActionResult> Assign(int id, [FromBody] AssignmentDto dto)
    {
        var complaint = await _context.Complaints.FindAsync(id);
        if (complaint == null)
            return NotFound(new ApiResponse { Success = false, Message = "Not Found" });

        complaint.AssignedTo = dto.StaffId;
        complaint.AssignedBy = dto.ManagerId ?? int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
        complaint.AssignedAt = DateTime.UtcNow;
        complaint.Status = "Assigned";

        await _context.SaveChangesAsync();
        await _auditService.LogChangeAsync<Complaint>("Assign", "Complaint", complaint);

        await _notificationService.SendAsync(
            dto.StaffId,
            "Complaint Assigned",
            $"Complaint #{complaint.ComplaintNumber} has been assigned to you",
            "complaint_assigned",
            complaint.Id);

        return Ok(new ApiResponse { Success = true, Message = "Assigned successfully" });
    }

    // PATCH /complaint-actions/{id}/status
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
}
