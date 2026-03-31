using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;
using System.Security.Claims;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("chat")]
public class ChatController : ControllerBase
{
    private readonly AppDbContext _context;
    public ChatController(AppDbContext context) => _context = context;

    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    private int CurrentAssocId => int.TryParse(User.FindFirst("AssociationId")?.Value, out var id) ? id : 0;

    // Get all users in the same association (for chat list)
    [HttpGet("users")]
    public async Task<ActionResult> GetUsers()
    {
        var users = await _context.Users
            .Where(u => u.AssociationId == CurrentAssocId && u.Id != CurrentUserId)
            .Select(u => new {
                u.Id,
                u.FullName,
                u.Username,
                role = u.Role.ToString(),
                u.IsActive,
                u.ProfilePicture
            })
            .ToListAsync();

        return Ok(new ApiResponse<dynamic> { Success = true, Data = users });
    }

    // Get DM history with a user
    [HttpGet("history/{userId}")]
    public async Task<ActionResult> GetHistory(int userId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var messages = await _context.ChatMessages
            .Where(m =>
                (m.SenderId == CurrentUserId && m.ReceiverId == userId) ||
                (m.SenderId == userId && m.ReceiverId == CurrentUserId))
            .OrderByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new {
                m.Id, m.SenderId, m.ReceiverId, m.Message,
                m.Type, m.Payload, m.IsRead, m.CreatedAt,
                senderName = _context.Users.IgnoreQueryFilters()
                    .Where(u => u.Id == m.SenderId)
                    .Select(u => u.FullName)
                    .FirstOrDefault()
            })
            .ToListAsync();

        // Mark as read
        await _context.ChatMessages
            .Where(m => m.SenderId == userId && m.ReceiverId == CurrentUserId && !m.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.IsRead, true));

        return Ok(new ApiResponse<dynamic> { Success = true, Data = messages });
    }

    // Get unread counts
    [HttpGet("unread")]
    public async Task<ActionResult> GetUnread()
    {
        var unread = await _context.ChatMessages
            .Where(m => m.ReceiverId == CurrentUserId && !m.IsRead)
            .GroupBy(m => m.SenderId)
            .Select(g => new { userId = g.Key, count = g.Count() })
            .ToListAsync();

        return Ok(new ApiResponse<dynamic> { Success = true, Data = unread });
    }

    // Upload file attachment for chat
    [HttpPost("upload")]
    public async Task<ActionResult> UploadFile(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new ApiResponse { Success = false, Message = "No file provided" });

        if (file.Length > 10 * 1024 * 1024) // 10MB limit
            return BadRequest(new ApiResponse { Success = false, Message = "File too large (max 10MB)" });

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        var base64 = Convert.ToBase64String(ms.ToArray());
        var dataUrl = $"data:{file.ContentType};base64,{base64}";

        return Ok(new ApiResponse<object> { Success = true, Data = new {
            dataUrl,
            fileName = file.FileName,
            fileType = file.ContentType,
            fileSize = file.Length
        }});
    }

    // Delete a message — admin can delete any, user can only delete their own
    [HttpDelete("messages/{messageId}")]
    public async Task<ActionResult> DeleteMessage(int messageId)
    {
        var msg = await _context.ChatMessages.FindAsync(messageId);
        if (msg == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });

        var isAdmin = User.IsInRole("super_admin") || User.IsInRole("admin");
        if (!isAdmin && msg.SenderId != CurrentUserId)
            return Forbid();

        _context.ChatMessages.Remove(msg);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Deleted" });
    }

    // Mark DMs from a user as read
    [HttpPost("mark-read/{userId}")]
    public async Task<ActionResult> MarkRead(int userId)
    {
        await _context.ChatMessages
            .Where(m => m.SenderId == userId && m.ReceiverId == CurrentUserId && !m.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.IsRead, true));

        return Ok(new ApiResponse { Success = true, Message = "Marked as read" });
    }

    // Send a DM
    [HttpPost("send")]
    public async Task<ActionResult> Send([FromBody] SendMessageDto dto)
    {
        var msg = new ChatMessage
        {
            SenderId = CurrentUserId,
            ReceiverId = dto.ReceiverId,
            Message = dto.Message,
            Type = dto.Type ?? "text",
            Payload = dto.Payload,
            CreatedAt = DateTime.UtcNow
        };
        _context.ChatMessages.Add(msg);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<ChatMessage> { Success = true, Data = msg });
    }

    // Get groups for current user
    [HttpGet("groups")]
    public async Task<ActionResult> GetGroups()
    {
        var memberGroupIds = await _context.ChatGroupMembers
            .Where(m => m.UserId == CurrentUserId)
            .Select(m => m.GroupId)
            .ToListAsync();

        var groups = await _context.ChatGroups
            .Where(g => memberGroupIds.Contains(g.Id) || g.CreatedBy == CurrentUserId)
            .Select(g => new {
                g.Id, g.GroupName, g.CreatedBy, g.CreatedAt,
                memberCount = _context.ChatGroupMembers.Count(m => m.GroupId == g.Id)
            })
            .ToListAsync();

        return Ok(new ApiResponse<dynamic> { Success = true, Data = groups });
    }

    // Get group messages
    [HttpGet("groups/{groupId}")]
    public async Task<ActionResult> GetGroup(int groupId)
    {
        var group = await _context.ChatGroups
            .FirstOrDefaultAsync(g => g.Id == groupId);
        if (group == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });

        var memberIds = await _context.ChatGroupMembers
            .Where(m => m.GroupId == groupId)
            .Select(m => m.UserId)
            .ToListAsync();

        var memberDetails = await _context.Users.IgnoreQueryFilters()
            .Where(u => memberIds.Contains(u.Id))
            .Select(u => new { userId = u.Id, name = u.FullName, role = u.Role.ToString() })
            .ToListAsync();

        return Ok(new ApiResponse<dynamic> { Success = true, Data = new {
            group.Id, group.GroupName, group.CreatedBy, group.CreatedAt,
            memberCount = memberIds.Count,
            members = memberDetails
        }});
    }

    [HttpGet("groups/{groupId}/messages")]
    public async Task<ActionResult> GetGroupMessages(int groupId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var messages = await _context.ChatMessages
            .Where(m => m.GroupId == groupId)
            .OrderByDescending(m => m.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new {
                m.Id, m.SenderId, m.ReceiverId, m.GroupId,
                m.Message, m.Type, m.Payload, m.IsRead, m.CreatedAt,
                senderName = _context.Users.IgnoreQueryFilters()
                    .Where(u => u.Id == m.SenderId)
                    .Select(u => u.FullName)
                    .FirstOrDefault()
            })
            .ToListAsync();

        return Ok(new ApiResponse<dynamic> { Success = true, Data = messages });
    }

    // Create group — admin/manager only
    [Authorize(Roles = "super_admin,admin,sub_admin,property_manager")]
    [HttpPost("groups")]
    public async Task<ActionResult> CreateGroup([FromBody] CreateGroupDto dto)
    {
        var group = new ChatGroup
        {
            GroupName = dto.GroupName,
            CreatedBy = CurrentUserId,
            AssociationId = CurrentAssocId,
            CreatedAt = DateTime.UtcNow
        };
        _context.ChatGroups.Add(group);
        await _context.SaveChangesAsync();

        // Add members
        var members = dto.MemberIds.Select(uid => new ChatGroupMember { GroupId = group.Id, UserId = uid }).ToList();
        members.Add(new ChatGroupMember { GroupId = group.Id, UserId = CurrentUserId });
        _context.ChatGroupMembers.AddRange(members);
        await _context.SaveChangesAsync();

        return Ok(new ApiResponse<object> { Success = true, Data = new {
            group.Id, group.GroupName, group.CreatedBy, group.CreatedAt,
            memberCount = members.Count
        }});
    }

    // Send group message
    [HttpPost("groups/{groupId}/messages")]
    public async Task<ActionResult> SendGroupMessage(int groupId, [FromBody] SendMessageDto dto)
    {
        var msg = new ChatMessage
        {
            SenderId = CurrentUserId,
            GroupId = groupId,
            Message = dto.Message,
            Type = dto.Type ?? "text",
            Payload = dto.Payload,
            CreatedAt = DateTime.UtcNow
        };
        _context.ChatMessages.Add(msg);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<ChatMessage> { Success = true, Data = msg });
    }
}

public class SendMessageDto
{
    public int? ReceiverId { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Type { get; set; }
    public string? Payload { get; set; }
}

public class CreateGroupDto
{
    public string GroupName { get; set; } = string.Empty;
    public List<int> MemberIds { get; set; } = new();
}
