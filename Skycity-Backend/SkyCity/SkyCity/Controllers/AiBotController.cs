using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("aibot")]
public class AiBotController : ControllerBase
{
    private readonly AppDbContext _context;
    public AiBotController(AppDbContext context) => _context = context;

    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    private int CurrentAssocId => int.TryParse(User.FindFirst("AssociationId")?.Value, out var id) ? id : 0;
    private string CurrentRole => User.FindFirst(ClaimTypes.Role)?.Value ?? "";
    private bool IsAdmin => CurrentRole is "admin" or "super_admin" or "sub_admin";

    [HttpPost("message")]
    public async Task<ActionResult> ProcessMessage([FromBody] BotMessageDto dto)
    {
        var msg = dto.Message?.Trim().ToLower() ?? "";
        var original = dto.Message?.Trim() ?? "";

        // ── CANCEL ──────────────────────────────────────────────────────────
        if (msg == "cancel")
            return Ok(BotReply("❌ Cancelled. What else can I help you with?"));

        // ── CONFIRMATION ─────────────────────────────────────────────────────
        if (msg.StartsWith("confirm:"))
        {
            var confirmCmd = original.Substring(8).Trim();
            return await HandleConfirm(confirmCmd);
        }

        // ── HELP ─────────────────────────────────────────────────────────────
        if (msg is "help" or "hi" or "hello" or "hey" or "what can you do")
        {
            var adminCmds = IsAdmin ? "\n\n🔧 **Admin Actions**\n• `assign task` — Assign work to employee\n• `add user` — Create new user\n• `add work type` — Add work category\n• `add property` — Add tower/area\n• `allocate work [title] to [name] due [date]`" : "";
            return Ok(BotReply(
                "Hello! 👋 I'm your SkyCity AI Assistant.\n\n" +
                "📋 **View Data**\n" +
                "• `show my tasks` — Your assigned tasks\n" +
                "• `show all users` — All employees\n" +
                "• `show pending tasks` — Pending work\n" +
                "• `show properties` — All properties\n" +
                "• `show complaints` — Recent complaints\n" +
                "• `summary` — System overview" +
                adminCmds +
                "\n\n💡 You can also **speak** your request using the microphone button!"
            ));
        }

        // ── SHOW MY TASKS ────────────────────────────────────────────────────
        if (msg.Contains("my task") || msg.Contains("my work") || msg.Contains("assigned to me"))
        {
            var tasks = await _context.WorkAllocations
                .Where(a => a.AssignedTo == CurrentUserId)
                .OrderByDescending(a => a.CreatedAt).Take(10).ToListAsync();
            if (!tasks.Any()) return Ok(BotReply("You have no tasks assigned. 🎉"));
            var lines = tasks.Select(t => $"• **{t.Title}** — {t.Status} (Due: {t.DueDate:MMM dd})");
            return Ok(BotReply($"📋 Your tasks ({tasks.Count}):\n\n" + string.Join("\n", lines)));
        }

        // ── SHOW PENDING ─────────────────────────────────────────────────────
        if (msg.Contains("pending task") || msg.Contains("pending work"))
        {
            var tasks = await _context.WorkAllocations
                .Where(a => a.AssociationId == CurrentAssocId && a.Status == "pending")
                .OrderBy(a => a.DueDate).Take(10).ToListAsync();
            if (!tasks.Any()) return Ok(BotReply("No pending tasks. ✅"));
            var uids = tasks.Select(t => t.AssignedTo).Distinct().ToList();
            var umap = (await _context.Users.Where(u => uids.Contains(u.Id)).Select(u => new { u.Id, u.FullName }).ToListAsync()).ToDictionary(u => u.Id, u => u.FullName);
            var lines = tasks.Select(t => $"• **{t.Title}** → {umap.GetValueOrDefault(t.AssignedTo, "?")} (Due: {t.DueDate:MMM dd})");
            return Ok(BotReply($"⏳ Pending ({tasks.Count}):\n\n" + string.Join("\n", lines)));
        }

        // ── SHOW ALL WORK ORDERS ─────────────────────────────────────────────
        if (msg.Contains("all work order") || msg.Contains("show work order") || msg.Contains("work order"))
        {
            var tasks = await _context.WorkAllocations.Where(a => a.AssociationId == CurrentAssocId).OrderByDescending(a => a.CreatedAt).Take(10).ToListAsync();
            if (!tasks.Any()) return Ok(BotReply("No work orders found."));
            var lines = tasks.Select(t => $"• **{t.Title}** — {t.Status} (Due: {t.DueDate:MMM dd})");
            return Ok(BotReply($"📋 Work orders ({tasks.Count}):\n\n" + string.Join("\n", lines)));
        }

        // ── SHOW USERS ───────────────────────────────────────────────────────
        if (msg.Contains("all user") || msg.Contains("all employee") || msg.Contains("show user") || msg.Contains("show employee"))
        {
            var users = await _context.Users.Where(u => u.AssociationId == CurrentAssocId).Select(u => new { u.FullName, u.Role, u.IsActive }).ToListAsync();
            if (!users.Any()) return Ok(BotReply("No users found."));
            var lines = users.Select(u => $"• **{u.FullName}** — {u.Role} {(u.IsActive ? "✅" : "❌")}");
            return Ok(BotReply($"👥 Users ({users.Count}):\n\n" + string.Join("\n", lines)));
        }

        // ── ADD PROPERTY (admin) — check BEFORE show properties ──────────────
        if ((msg.Contains("add property") || msg.Contains("add tower") || msg.Contains("new property") || msg.Contains("create property")) && IsAdmin)
        {
            var nameM = Regex.Match(original, @"(?:add|create|new)\s+(?:property|tower|area)\s+([A-Za-z0-9\s]+?)(?:\s+type|\s*$)", RegexOptions.IgnoreCase);
            var typeM = Regex.Match(original, @"type\s+(apartment|tower|others|common)", RegexOptions.IgnoreCase);

            if (!nameM.Success)
                return Ok(BotReply(
                    "🏢 **Add a New Property**\n\nPlease provide the property details:\n\n• **Name** — e.g. Tower A, Swimming Pool\n• **Type** — apartment or others (common area)\n\nSay it like:\n`add property Tower A type apartment`\n`add property Swimming Pool type others`",
                    new List<string> {
                        "add property Tower A type apartment",
                        "add property Club House type others",
                        "add property Block B type apartment",
                    }
                ));

            var propName = nameM.Groups[1].Value.Trim();
            var propType = typeM.Success ? (typeM.Groups[1].Value.ToLower() == "apartment" || typeM.Groups[1].Value.ToLower() == "tower" ? "apartment" : "others") : "apartment";

            return Ok(BotReply(
                $"🏢 **Confirm new property:**\n\n• **Name:** {propName}\n• **Type:** {(propType == "apartment" ? "Apartment / Tower" : "Common Area")}\n\nCreate this property?",
                new List<string> { $"confirm:add-property name={propName} type={propType}", "cancel" }
            ));
        }

        // ── SHOW PROPERTIES ──────────────────────────────────────────────────
        if ((msg.Contains("show") || msg.Contains("list") || msg.Contains("view") || msg.Contains("all")) && (msg.Contains("propert") || msg.Contains("tower") || msg.Contains("building")))
        {
            var props = await _context.Properties.Where(p => p.AssociationId == CurrentAssocId).Select(p => new { p.PropertyName, p.PropertyType, p.TotalUnits }).ToListAsync();
            if (!props.Any()) return Ok(BotReply("No properties found."));
            var lines = props.Select(p => $"• **{p.PropertyName}** — {p.PropertyType} ({p.TotalUnits} units)");
            return Ok(BotReply($"🏢 Properties ({props.Count}):\n\n" + string.Join("\n", lines)));
        }

        // ── SHOW COMPLAINTS ──────────────────────────────────────────────────
        if (msg.Contains("complaint"))
        {
            var complaints = await _context.Complaints.OrderByDescending(c => c.CreatedAt).Take(5).Select(c => new { c.Title, c.Status, c.Priority }).ToListAsync();
            if (!complaints.Any()) return Ok(BotReply("No complaints found."));
            var lines = complaints.Select(c => $"• **{c.Title}** — {c.Status} ({c.Priority})");
            return Ok(BotReply($"📝 Recent complaints:\n\n" + string.Join("\n", lines)));
        }

        // ── SUMMARY ──────────────────────────────────────────────────────────
        if (msg.Contains("stat") || msg.Contains("summary") || msg.Contains("overview") || msg.Contains("dashboard"))
        {
            var totalUsers = await _context.Users.CountAsync(u => u.AssociationId == CurrentAssocId);
            var totalTasks = await _context.WorkAllocations.CountAsync(a => a.AssociationId == CurrentAssocId);
            var completed = await _context.WorkAllocations.CountAsync(a => a.AssociationId == CurrentAssocId && a.Status == "completed");
            var pending = await _context.WorkAllocations.CountAsync(a => a.AssociationId == CurrentAssocId && a.Status == "pending");
            var inProgress = await _context.WorkAllocations.CountAsync(a => a.AssociationId == CurrentAssocId && a.Status == "in-progress");
            return Ok(BotReply($"📊 **System Overview**\n\n👥 Users: **{totalUsers}**\n📋 Work Orders: **{totalTasks}**\n✅ Completed: **{completed}**\n⏳ Pending: **{pending}**\n🔄 In Progress: **{inProgress}**\n📈 Rate: **{(totalTasks > 0 ? Math.Round((double)completed / totalTasks * 100) : 0)}%**"));
        }

        // ── ADD WORK TYPE (admin) ─────────────────────────────────────────────
        if ((msg.Contains("add work type") || msg.Contains("create work type") || msg.Contains("new work type") || msg.Contains("add work category")) && IsAdmin)
        {
            // "add work type Plumbing code PL01" or just "add work type"
            var titleM = Regex.Match(original, @"(?:add|create|new)\s+work\s+(?:type|category)\s+([A-Za-z\s]+?)(?:\s+code|\s*$)", RegexOptions.IgnoreCase);
            var codeM = Regex.Match(original, @"code\s+([A-Z0-9]+)", RegexOptions.IgnoreCase);

            if (!titleM.Success)
                return Ok(BotReply("To add a work type, say:\n`add work type [Title] code [Code]`\n\nExample: `add work type Plumbing Repair code PL01`"));

            var workTitle = titleM.Groups[1].Value.Trim();
            var workCode = codeM.Success ? codeM.Groups[1].Value.Trim().ToUpper() : workTitle.Substring(0, Math.Min(4, workTitle.Length)).ToUpper().Replace(" ", "");

            return Ok(BotReply(
                $"📋 **Confirm new work type:**\n\n• **Title:** {workTitle}\n• **Code:** {workCode}\n• **Type:** Standard\n\nCreate this work type?",
                new List<string> { $"confirm:add-work-type title={workTitle} code={workCode}", "cancel" }
            ));
        }

        // ── ADD USER (admin) ──────────────────────────────────────────────────
        if ((msg.Contains("add user") || msg.Contains("create user") || msg.Contains("new user")) && IsAdmin)
        {
            var nameM = Regex.Match(original, @"(?:add|create|new)\s+user\s+([A-Za-z\s]+?)(?:\s+email|\s+role|$)", RegexOptions.IgnoreCase);
            var emailM = Regex.Match(original, @"email\s+([\w.@+-]+)", RegexOptions.IgnoreCase);
            var roleM = Regex.Match(original, @"role\s+(\w+)", RegexOptions.IgnoreCase);

            if (!nameM.Success)
                return Ok(BotReply("To add a user, say:\n`add user [Full Name] email [email] role [staff/admin/resident]`\n\nExample: `add user John Smith email john@test.com role staff`"));

            if (!emailM.Success)
                return Ok(BotReply($"Got name **{nameM.Groups[1].Value.Trim()}**. What's their email?\n\nSay: `add user {nameM.Groups[1].Value.Trim()} email [email] role staff`"));

            var fullName = nameM.Groups[1].Value.Trim();
            var email = emailM.Groups[1].Value.Trim();
            var role = roleM.Success ? roleM.Groups[1].Value.Trim().ToLower() : "staff";
            var username = email.Split('@')[0].ToLower().Replace(".", "");

            if (await _context.Users.AnyAsync(u => u.Username == username))
                return Ok(BotReply($"⚠️ Username **{username}** already exists."));

            return Ok(BotReply(
                $"👤 **Confirm new user:**\n\n• **Name:** {fullName}\n• **Username:** {username}\n• **Email:** {email}\n• **Role:** {role}\n• **Password:** Welcome@123\n\nCreate this user?",
                new List<string> { $"confirm:add-user name={fullName} email={email} role={role}", "cancel" }
            ));
        }

        // ── ASSIGN TASK (admin) ───────────────────────────────────────────────
        if ((msg.Contains("assign task") || msg.Contains("assign work") || msg.Contains("allocate") || msg.Contains("task for")) && IsAdmin)
        {
            // Full: "allocate work [title] to [name] due [date]"
            var fullM = Regex.Match(original, @"(?:allocate|assign)\s+work\s+(.+?)\s+to\s+([A-Za-z\s]+?)(?:\s+due\s+(.+))?$", RegexOptions.IgnoreCase);
            var nameForM = Regex.Match(original, @"(?:task|work)\s+(?:for|to)\s+([A-Za-z\s]+?)(?:\s+due|\s*$)", RegexOptions.IgnoreCase);
            var dueM = Regex.Match(original, @"due\s+(.+?)(?:\s*$)", RegexOptions.IgnoreCase);

            if (fullM.Success)
            {
                var title = fullM.Groups[1].Value.Trim();
                var assigneeName = fullM.Groups[2].Value.Trim();
                var dueStr = fullM.Groups[3].Success ? fullM.Groups[3].Value.Trim() : "";

                var assignee = await _context.Users.Where(u => u.AssociationId == CurrentAssocId && u.FullName.ToLower().Contains(assigneeName.ToLower())).FirstOrDefaultAsync();
                if (assignee == null)
                {
                    var empList = await _context.Users.Where(u => u.AssociationId == CurrentAssocId).Select(u => u.FullName).Take(10).ToListAsync();
                    return Ok(BotReply($"⚠️ Could not find **{assigneeName}**. Choose:", empList.Select(n => $"allocate work {title} to {n}").ToList()));
                }

                var dueDate = DateTime.UtcNow.AddDays(7);
                if (!string.IsNullOrEmpty(dueStr) && DateTime.TryParse(dueStr, out var pd)) dueDate = pd;

                // If no due date specified, ask for it
                if (string.IsNullOrEmpty(dueStr))
                {
                    return Ok(BotReply(
                        $"📅 **When is this due?**\n\nTask: **{title}** → {assignee.FullName}\n\nChoose a due date:",
                        new List<string> {
                            $"set-due:allocate work {title} to {assignee.FullName} due {DateTime.UtcNow.AddDays(1):yyyy-MM-dd}",
                            $"set-due:allocate work {title} to {assignee.FullName} due {DateTime.UtcNow.AddDays(3):yyyy-MM-dd}",
                            $"set-due:allocate work {title} to {assignee.FullName} due {DateTime.UtcNow.AddDays(7):yyyy-MM-dd}",
                            $"set-due:allocate work {title} to {assignee.FullName} due {DateTime.UtcNow.AddDays(14):yyyy-MM-dd}",
                        }
                    ));
                }

                return Ok(BotReply(
                    $"📋 **Confirm work order:**\n\n• **Task:** {title}\n• **Assigned to:** {assignee.FullName}\n• **Due:** {dueDate:MMM dd, yyyy}\n• **Priority:** Medium",
                    new List<string> { $"confirm:allocate work {title} to {assignee.FullName} due {dueDate:yyyy-MM-dd}", "cancel" }
                ));
            }

            // "set-due:" prefix — user selected a due date option
            if (msg.StartsWith("set-due:"))
            {
                var cmd = original.Substring(8).Trim();
                return await ProcessMessage(new BotMessageDto { Message = cmd });
            }

            // "assign task for [name]"
            if (nameForM.Success)
            {
                var assigneeName = nameForM.Groups[1].Value.Trim();
                var assignee = await _context.Users.Where(u => u.AssociationId == CurrentAssocId && u.FullName.ToLower().Contains(assigneeName.ToLower())).FirstOrDefaultAsync();

                if (assignee == null)
                {
                    var empList = await _context.Users.Where(u => u.AssociationId == CurrentAssocId).Select(u => u.FullName).Take(10).ToListAsync();
                    return Ok(BotReply($"⚠️ Could not find **{assigneeName}**. Choose:", empList.Select(n => $"assign task for {n}").ToList()));
                }

                var works = await _context.WorkCategories.Take(8).Select(w => w.WorkTitle).ToListAsync();
                return Ok(BotReply($"Found **{assignee.FullName}**! 👤\n\nChoose a work type:", works.Select(w => $"allocate work {w} to {assignee.FullName}").ToList()));
            }

            // Just "assign task" — show employee list
            var employees = await _context.Users.Where(u => u.AssociationId == CurrentAssocId).Select(u => u.FullName).Take(10).ToListAsync();
            return Ok(BotReply("Who do you want to assign a task to?", employees.Select(n => $"assign task for {n}").ToList()));
        }

        // ── SHOW REPORTS ──────────────────────────────────────────────────────
        if (msg.Contains("report") && (msg.Contains("show") || msg.Contains("list") || msg.Contains("view")))
        {
            var reports = await _context.WorkAllocations.Where(a => a.AssignedTo == CurrentUserId).OrderByDescending(a => a.CreatedAt).Take(5).ToListAsync();
            if (!reports.Any()) return Ok(BotReply("No reports found."));
            var lines = reports.Select(r => $"• **{r.Title}** — {r.Status} ({r.CreatedAt:MMM dd})");
            return Ok(BotReply($"📊 Recent reports:\n\n" + string.Join("\n", lines)));
        }

        // ── DEFAULT ───────────────────────────────────────────────────────────
        return Ok(BotReply($"I'm not sure how to help with that. Type **help** to see what I can do! 🤖\n\nYou said: \"{original}\""));
    }

    private async Task<ActionResult> HandleConfirm(string cmd)
    {
        // Confirm: allocate work
        var allocM = Regex.Match(cmd, @"allocate work (.+?) to ([A-Za-z\s]+?) due (\S+)", RegexOptions.IgnoreCase);
        if (allocM.Success)
        {
            var title = allocM.Groups[1].Value.Trim();
            var assigneeName = allocM.Groups[2].Value.Trim();
            var dueStr = allocM.Groups[3].Value.Trim();
            var assignee = await _context.Users.Where(u => u.AssociationId == CurrentAssocId && u.FullName.ToLower().Contains(assigneeName.ToLower())).FirstOrDefaultAsync();
            if (assignee == null) return Ok(BotReply("⚠️ Employee not found. Please try again."));
            var dueDate = DateTime.TryParse(dueStr, out var pd) ? pd : DateTime.UtcNow.AddDays(7);
            _context.WorkAllocations.Add(new WorkAllocation { Title = title, AssignedTo = assignee.Id, AssignedBy = CurrentUserId, AssociationId = CurrentAssocId, Priority = "medium", Status = "pending", DueDate = dueDate, CreatedAt = DateTime.UtcNow });
            await _context.SaveChangesAsync();
            return Ok(BotReply($"✅ Work order created!\n\n📋 **{title}**\n👤 {assignee.FullName}\n📅 Due: {dueDate:MMM dd, yyyy}"));
        }

        // Confirm: add work type
        var workM = Regex.Match(cmd, @"add-work-type title=(.+?) code=(\S+)", RegexOptions.IgnoreCase);
        if (workM.Success)
        {
            var workTitle = workM.Groups[1].Value.Trim();
            var workCode = workM.Groups[2].Value.Trim().ToUpper();
            if (await _context.WorkCategories.AnyAsync(w => w.WorkCode == workCode))
                return Ok(BotReply($"⚠️ Work code **{workCode}** already exists."));
            _context.WorkCategories.Add(new WorkCategory { WorkCode = workCode, WorkTitle = workTitle, WorkType = "Standard", IsActive = true, CreatedAt = DateTime.UtcNow });
            await _context.SaveChangesAsync();
            return Ok(BotReply($"✅ Work type created!\n\n📋 **{workTitle}** [{workCode}]"));
        }

        // Confirm: add property
        var propM = Regex.Match(cmd, @"add-property name=(.+?) type=(\S+)", RegexOptions.IgnoreCase);
        if (propM.Success)
        {
            var propName = propM.Groups[1].Value.Trim();
            var propType = propM.Groups[2].Value.Trim();
            _context.Properties.Add(new Property { PropertyName = propName, PropertyType = propType, AssociationId = CurrentAssocId, TotalUnits = 0, CreatedAt = DateTime.UtcNow, IsDeleted = true });
            await _context.SaveChangesAsync();
            return Ok(BotReply($"✅ Property created!\n\n🏢 **{propName}** ({(propType == "apartment" ? "Apartment/Tower" : "Common Area")})"));
        }

        // Confirm: add user
        var userM = Regex.Match(cmd, @"add-user name=(.+?) email=(\S+) role=(\S+)", RegexOptions.IgnoreCase);
        if (userM.Success)
        {
            var fullName = userM.Groups[1].Value.Trim();
            var email = userM.Groups[2].Value.Trim();
            var role = userM.Groups[3].Value.Trim().ToLower();
            var username = email.Split('@')[0].ToLower().Replace(".", "");
            if (!Enum.TryParse<UserRole>(role, true, out var userRole)) userRole = UserRole.staff;
            _context.Users.Add(new User { Username = username, PasswordHash = BCrypt.Net.BCrypt.HashPassword("Welcome@123"), FullName = fullName, Role = userRole, AssociationId = CurrentAssocId, IsActive = true, IsDeleted = true, CreatedAt = DateTime.UtcNow });
            await _context.SaveChangesAsync();
            return Ok(BotReply($"✅ User created!\n\n👤 **{fullName}**\n📧 Username: `{username}`\n🔑 Role: {role}\n🔒 Password: `Welcome@123`"));
        }

        return Ok(BotReply("⚠️ Could not process confirmation. Please try again."));
    }

    private static object BotReply(string text, List<string>? actions = null) => new
    {
        success = true,
        data = new { message = text, timestamp = DateTime.UtcNow, actions = actions ?? new List<string>() }
    };
}

public class BotMessageDto
{
    public string Message { get; set; } = string.Empty;
}
