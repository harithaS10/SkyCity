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
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _context;

    public DashboardController(AppDbContext context)
    {
        _context = context;
    }

    [ResponseCache(Duration = 60, VaryByQueryKeys = new[] { "*" })]
    [HttpGet("stats")]
    public async Task<ActionResult> GetStats()
    {
        // Internal helper to get collective stats
        var stats = await GetCollectiveStats();
        return Ok(new ApiResponse<object> { Data = stats });
    }

    [HttpGet("resident/{userId}")]
    public async Task<ActionResult> GetResidentStats(int userId)
    {
        // Global query filter already restricts by AssociationId if user is in one
        // We further filter by ResidentId for personal context if role is resident
        var stats = await GetCollectiveStats();
        return Ok(new ApiResponse<object> { Data = stats });
    }

    [HttpGet("manager/{associationId}")]
    public async Task<ActionResult> GetManagerStats(int associationId)
    {
        var stats = await GetCollectiveStats();
        return Ok(new ApiResponse<object> { Data = stats });
    }

    private async Task<object> GetCollectiveStats()
    {
        var totalComplaints = await _context.Complaints.CountAsync();
        var openComplaints = await _context.Complaints.CountAsync(c => c.Status == "Open");
        var resolvedComplaints = await _context.Complaints.CountAsync(c => c.Status == "Resolved");
        var activeWorkOrders = await _context.WorkOrders.CountAsync(w => w.Status != "Completed");
        
        var recentComplaints = await _context.Complaints
            .OrderByDescending(c => c.CreatedAt)
            .Take(5)
            .ToListAsync();

        return new
        {
            Complaints = new { Total = totalComplaints, Open = openComplaints, Resolved = resolvedComplaints },
            WorkOrders = new { Active = activeWorkOrders },
            RecentComplaints = recentComplaints
        };
    }

    [ResponseCache(Duration = 300)]
    [HttpGet("analytics/categories")]
    public async Task<ActionResult> GetCategoryAnalytics()
    {
        var stats = await _context.Complaints
            .GroupBy(c => c.Category!.CategoryName)
            .Select(g => new { Category = g.Key, Count = g.Count() })
            .ToListAsync();

        return Ok(new ApiResponse<IEnumerable<object>> { Data = stats });
    }

    [Authorize(Roles = "resident,staff,property_manager,admin,super_admin")]
    [ResponseCache(Duration = 60, VaryByHeader = "Authorization")]
    [HttpGet("resident")]
    public async Task<ActionResult> GetResidentStats()
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdStr, out var userId)) return Unauthorized();

        var complaints = await _context.Complaints
            .Where(c => c.ResidentId == userId)
            .GroupBy(c => c.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        var latestBill = await _context.Bills
            .Where(b => _context.Units.Any(u => u.Id == b.UnitId && u.ResidentId == userId))
            .OrderByDescending(b => b.DueDate)
            .FirstOrDefaultAsync();

        return Ok(new { Complaints = complaints, LatestBill = latestBill });
    }

    [Authorize(Roles = "super_admin,admin,sub_admin,property_manager")]
    [ResponseCache(Duration = 120, VaryByHeader = "Authorization")]
    [HttpGet("manager")]
    public async Task<ActionResult> GetManagerStats()
    {
        var assocIdStr = User.FindFirst("AssociationId")?.Value;
        if (!int.TryParse(assocIdStr, out var associationId)) return Unauthorized();

        // Global Query Filter handles AssociationId isolation for Complaints and other entities
        var totalComplaints = await _context.Complaints.CountAsync();

        var pendingComplaints = await _context.Complaints
            .CountAsync(c => c.Status == "Open");

        var resolvedComplaints = await _context.Complaints
            .CountAsync(c => c.Status == "Resolved");

        var staffPerformance = await _context.Complaints
            .Where(c => c.AssignedTo != null)
            .GroupBy(c => c.AssignedTo)
            .Select(g => new 
            { 
                StaffId = g.Key, 
                ResolvedCount = g.Count(c => c.Status == "Resolved"),
                AvgRating = g.Average(c => c.Rating ?? 0)
            })
            .ToListAsync();

        return Ok(new 
        { 
            TotalComplaints = totalComplaints, 
            Pending = pendingComplaints, 
            Resolved = resolvedComplaints,
            StaffPerformance = staffPerformance
        });
    }
}
