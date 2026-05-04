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

    public NotificationsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult> GetMyNotifications()
    {
        try
        {
            var items = await _context.Notifications
                .IgnoreQueryFilters()
                .Where(n => n.UserId == CurrentUserId && n.IsDeleted)
                .OrderByDescending(n => n.CreatedAt)
                .Take(50)
                .Select(n => new {
                    n.Id, n.Title, n.Message, n.Type, n.ReferenceId, n.IsRead, n.CreatedAt
                })
                .ToListAsync();

            return Ok(new { success = true, data = items });
        }
        catch
        {
            return Ok(new { success = true, data = new object[0] });
        }
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult> GetUnreadCount()
    {
        try
        {
            var count = await _context.Notifications
                .IgnoreQueryFilters()
                .CountAsync(n => n.UserId == CurrentUserId && n.IsDeleted && !n.IsRead);
            return Ok(new { success = true, data = count });
        }
        catch
        {
            return Ok(new { success = true, data = 0 });
        }
    }

    [HttpPost("{id}/read")]
    public async Task<ActionResult> MarkRead(int id)
    {
        try
        {
            var n = await _context.Notifications.IgnoreQueryFilters()
                .FirstOrDefaultAsync(x => x.Id == id && x.UserId == CurrentUserId);
            if (n != null) { n.IsRead = true; await _context.SaveChangesAsync(); }
            return Ok(new { success = true });
        }
        catch { return Ok(new { success = true }); }
    }

    [HttpPost("mark-all-read")]
    public async Task<ActionResult> MarkAllRead()
    {
        try
        {
            var unread = await _context.Notifications
                .IgnoreQueryFilters()
                .Where(n => n.UserId == CurrentUserId && n.IsDeleted && !n.IsRead)
                .ToListAsync();
            unread.ForEach(n => n.IsRead = true);
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }
        catch { return Ok(new { success = true }); }
    }
}
