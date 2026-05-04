using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;
using System.Security.Claims;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("notifications")]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _context;
    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    private int CurrentAssocId => int.TryParse(User.FindFirst("AssociationId")?.Value, out var id) ? id : 0;

    public NotificationsController(AppDbContext context)
    {
        _context = context;
    }

    // GET /notifications — personal notifications for the logged-in user
    [HttpGet]
    public async Task<ActionResult> GetMyNotifications()
    {
        var items = await _context.Notifications
            .Where(n => n.UserId == CurrentUserId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .Select(n => new {
                n.Id, n.Title, n.Message, n.Type, n.ReferenceId, n.IsRead, n.CreatedAt
            })
            .ToListAsync();

        return Ok(new { success = true, data = items });
    }

    // GET /notifications/unread-count
    [HttpGet("unread-count")]
    public async Task<ActionResult> GetUnreadCount()
    {
        var count = await _context.Notifications
            .CountAsync(n => n.UserId == CurrentUserId && !n.IsRead);
        return Ok(new { success = true, data = count });
    }

    // POST /notifications/{id}/read
    [HttpPost("{id}/read")]
    public async Task<ActionResult> MarkRead(int id)
    {
        var n = await _context.Notifications.FindAsync(id);
        if (n == null || n.UserId != CurrentUserId)
            return NotFound(new { success = false });
        n.IsRead = true;
        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }

    // POST /notifications/mark-all-read
    [HttpPost("mark-all-read")]
    public async Task<ActionResult> MarkAllRead()
    {
        var unread = await _context.Notifications
            .Where(n => n.UserId == CurrentUserId && !n.IsRead)
            .ToListAsync();
        unread.ForEach(n => n.IsRead = true);
        await _context.SaveChangesAsync();
        return Ok(new { success = true });
    }
}
