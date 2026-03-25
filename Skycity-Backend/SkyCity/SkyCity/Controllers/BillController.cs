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
public class BillController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;
    private readonly INotificationService _notificationService;

    public BillController(
        AppDbContext context, 
        IAuditService auditService,
        INotificationService notificationService)
    {
        _context = context;
        _auditService = auditService;
        _notificationService = notificationService;
    }

    [HttpGet("unit/{unitId}")]
    public async Task<ActionResult> GetUnitBills(int unitId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _context.Bills
            .Where(b => b.UnitId == unitId)
            .OrderByDescending(b => b.DueDate);

        var total = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new ApiResponse<dynamic>
        {
            Data = new
            {
                Total = total,
                Page = page,
                PageSize = pageSize,
                Items = items
            }
        });
    }

    [Authorize(Roles = "super_admin,admin,accountant,property_manager")]
    [HttpGet("association/{associationId}")]
    public async Task<ActionResult> GetAssociationBills(int associationId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var userAssocId = int.Parse(User.FindFirst("AssociationId")?.Value ?? "0");
        if (associationId != userAssocId && !User.IsInRole("super_admin"))
            return Forbid();

        var query = _context.Bills
            .Include(b => b.Unit)
            .OrderByDescending(b => b.CreatedAt);

        var total = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new ApiResponse<dynamic>
        {
            Data = new
            {
                Total = total,
                Page = page,
                PageSize = pageSize,
                Items = items
            }
        });
    }

    [Authorize(Roles = "super_admin,admin,accountant")]
    [HttpPost]
    public async Task<ActionResult<Bill>> CreateBill([FromBody] CreateBillDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(new ApiResponse { Success = false, Message = "Invalid input" });

        var bill = new Bill
        {
            UnitId = dto.UnitId,
            BillNumber = $"INV-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}",
            BillType = dto.BillType,
            Amount = dto.Amount,
            Tax = dto.Tax,
            TotalAmount = dto.Amount + dto.Tax,
            DueDate = dto.DueDate,
            Status = "Pending",
            CreatedAt = DateTime.UtcNow
        };

        _context.Bills.Add(bill);
        await _context.SaveChangesAsync();

        await _auditService.LogChangeAsync<Bill>("Create", "Bill", bill);
        
        var unit = await _context.Units.FindAsync(dto.UnitId);
        if (unit?.ResidentId.HasValue == true)
        {
            await _notificationService.SendAsync(unit.ResidentId.Value, "New Bill", $"A new {dto.BillType} bill has been generated for your unit.", "Bill", bill.Id);
        }

        return Ok(bill);
    }

    [Authorize(Roles = "super_admin,admin,accountant,resident")]
    [HttpPatch("{id}/pay")]
    public async Task<IActionResult> RecordPayment(int id, [FromBody] UpdateBillStatusDto dto)
    {
        var bill = await _context.Bills.FindAsync(id);
        if (bill == null) return NotFound();

        var oldState = new { bill.Status, bill.PaymentReference };

        bill.Status = "Paid";
        bill.PaymentReference = dto.PaymentReference;
        bill.PaidAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _auditService.LogChangeAsync<Bill>("Pay", "Bill", bill);

        return NoContent();
    }

    [Authorize(Roles = "super_admin,admin,accountant")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteBill(int id)
    {
        var bill = await _context.Bills.FindAsync(id);
        if (bill == null) return NotFound();

        _context.Bills.Remove(bill);
        await _context.SaveChangesAsync();

        await _auditService.LogChangeAsync<Bill>("Delete", "Bill", bill);
        return NoContent();
    }
}
