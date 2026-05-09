using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.DTOs;
using SkycityBackend.Models;
using System.Security.Claims;

namespace SkycityBackend.Controllers
{
    [Authorize]
    [ApiController]
    [Route("dashboard")]
    public class DashboardController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DashboardController(AppDbContext context) => _context = context;

        private int CurrentUserId => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
        private int CurrentAssocId => int.TryParse(User.FindFirst("AssociationId")?.Value, out var id) ? id : 0;

        // GET /dashboard/stats — dashboard statistics for the current association
        [HttpGet("stats")]
        public async Task<ActionResult> GetStats()
        {
            try
            {
                var totalTasks = await _context.WorkAllocations
                    .CountAsync(a => a.AssociationId == CurrentAssocId);

                var completedTasks = await _context.WorkAllocations
                    .CountAsync(a => a.AssociationId == CurrentAssocId && a.Status == "completed");

                var inProgressTasks = await _context.WorkAllocations
                    .CountAsync(a => a.AssociationId == CurrentAssocId && a.Status == "in-progress");

                var pendingTasks = await _context.WorkAllocations
                    .CountAsync(a => a.AssociationId == CurrentAssocId && a.Status == "pending");

                // Overdue: pending/in-progress tasks with due date in the past
                var now = DateTime.UtcNow;
                var overdueTasks = await _context.WorkAllocations
                    .CountAsync(a => a.AssociationId == CurrentAssocId
                        && (a.Status == "pending" || a.Status == "in-progress")
                        && a.DueDate < now);

                var totalUsers = await _context.Users
                    .CountAsync(u => u.AssociationId == CurrentAssocId);

                // Use WorkAllocations as the report source (no separate Reports table)
                var totalReports = await _context.WorkAllocations
                    .CountAsync(a => a.AssociationId == CurrentAssocId);

                var stats = new
                {
                    totalTasks,
                    completedTasks,
                    inProgressTasks,
                    pendingTasks,
                    overdueTasks,
                    totalUsers,
                    totalReports
                };

                return Ok(new ApiResponse<object> { Success = true, Data = stats });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new ApiResponse { Success = false, Message = $"Error fetching stats: {ex.Message}" });
            }
        }
    }
}
