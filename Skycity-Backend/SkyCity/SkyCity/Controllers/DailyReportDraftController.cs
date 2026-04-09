using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;
using System.Security.Claims;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("daily-report-drafts")]
public class DailyReportDraftController : ControllerBase
{
    private readonly AppDbContext _context;
    public DailyReportDraftController(AppDbContext context) => _context = context;

    private int CurrentUserId => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    private int CurrentAssocId => int.TryParse(User.FindFirst("AssociationId")?.Value, out var id) ? id : 0;

    // GET /daily-report-drafts?date=2026-04-08
    [HttpGet]
    public async Task<ActionResult> Get([FromQuery] string date)
    {
        if (!DateTime.TryParse(date, out var reportDate))
            return BadRequest(new ApiResponse { Success = false, Message = "Invalid date" });

        var draft = await _context.DailyReportDrafts
            .FirstOrDefaultAsync(d => d.UserId == CurrentUserId && d.ReportDate.Date == reportDate.Date);

        if (draft == null)
            return Ok(new ApiResponse<dynamic> { Success = true, Data = null });

        return Ok(new ApiResponse<dynamic> { Success = true, Data = draft });
    }

    // POST /daily-report-drafts  { date, rowsJson, isSubmitted }
    [HttpPost]
    public async Task<ActionResult> Save([FromBody] SaveDraftDto dto)
    {
        if (!DateTime.TryParse(dto.Date, out var reportDate))
            return BadRequest(new ApiResponse { Success = false, Message = "Invalid date" });

        var draft = await _context.DailyReportDrafts
            .FirstOrDefaultAsync(d => d.UserId == CurrentUserId && d.ReportDate.Date == reportDate.Date);

        if (draft == null)
        {
            draft = new DailyReportDraft
            {
                UserId = CurrentUserId,
                AssociationId = CurrentAssocId,
                ReportDate = reportDate.Date,
                RowsJson = dto.RowsJson,
                IsSubmitted = dto.IsSubmitted,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };
            _context.DailyReportDrafts.Add(draft);
        }
        else
        {
            draft.RowsJson = dto.RowsJson;
            draft.IsSubmitted = dto.IsSubmitted;
            draft.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<dynamic> { Success = true, Data = draft });
    }
}

public class SaveDraftDto
{
    public string Date { get; set; } = string.Empty;
    public string RowsJson { get; set; } = "[]";
    public bool IsSubmitted { get; set; } = false;
}
