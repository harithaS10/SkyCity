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
public class WorkOrderController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;
    // private readonly INotificationService _notificationService; // Removed

    public WorkOrderController(
        AppDbContext context, 
        IAuditService auditService
        // INotificationService notificationService // Removed
        )
    {
        _context = context;
        _auditService = auditService;
        // _notificationService = notificationService; // Removed
    }

    [HttpGet]
    public async Task<ActionResult> GetWorkOrders(
        [FromQuery] int? vendorId, // Parameter order changed
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = _context.WorkOrders
            .Include(w => w.Complaint) // Added include
            .Include(w => w.Vendor) // Added include
            .AsQueryable();
        
        if (vendorId.HasValue)
            query = query.Where(w => w.VendorId == vendorId);
        
        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(w => w.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new ApiResponse<dynamic> // Changed return type
        {
            Data = new
            {
                Total = total,
                Page = page,
                PageSize = pageSize,
                // TotalPages = (int)Math.Ceiling(total / (double)pageSize), // Removed
                Items = items
            }
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult> GetWorkOrder(int id) // Changed return type
    {
        var workOrder = await _context.WorkOrders // Variable name changed
            .Include(w => w.Complaint)
            .Include(w => w.Vendor) // Added include
            .FirstOrDefaultAsync(w => w.Id == id);
            
        if (workOrder == null) 
            return NotFound(new ApiResponse { Success = false, Message = "Work order not found" }); // Changed NotFound return
        return Ok(new ApiResponse<WorkOrder> { Data = workOrder }); // Changed Ok return
    }

    [Authorize(Roles = "property_manager,admin,super_admin,helpdesk")] // Roles changed
    [HttpPost]
    public async Task<ActionResult> CreateWorkOrder([FromBody] CreateWorkOrderDto dto) // Changed return type
    {
        if (!ModelState.IsValid) 
            return BadRequest(new ApiResponse { Success = false, Message = "Invalid input" }); // Changed BadRequest return

        var workOrder = new WorkOrder
        {
            // WorkOrderNumber = $"WO-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}", // Removed
            ComplaintId = dto.ComplaintId,
            VendorId = dto.VendorId,
            WorkTitle = dto.WorkTitle, // Added
            Description = dto.Description,
            EstimatedCost = dto.EstimatedCost,
            Status = "Pending Approval", // Status changed
            CreatedAt = DateTime.UtcNow
        };

        _context.WorkOrders.Add(workOrder);
        await _context.SaveChangesAsync();

        await _auditService.LogChangeAsync<WorkOrder>("Create", "WorkOrder", workOrder);
        // await _notificationService.SendAsync(dto.VendorId, "New Work Order", $"A new work order #{workOrder.WorkOrderNumber} has been issued to you.", "WorkOrder", workOrder.Id); // Removed

        return CreatedAtAction(nameof(GetWorkOrder), new { id = workOrder.Id }, new ApiResponse<WorkOrder> { Data = workOrder }); // Changed return
    }

    // [Authorize(Roles = "super_admin,admin,sub_admin,vendor,property_manager")] // Removed
    [HttpPatch("{id}/status")]
    public async Task<IActionResult> UpdateWorkOrderStatus(int id, [FromBody] UpdateWorkOrderStatusDto dto) // Method name changed
    {
        var workOrder = await _context.WorkOrders.FindAsync(id); // Variable name changed
        if (workOrder == null) 
            return NotFound(new ApiResponse { Success = false, Message = "Not Found" }); // Changed NotFound return

        var oldStatus = workOrder.Status; // Changed oldState
        workOrder.Status = dto.Status;
        
        if (dto.Status == "Completed") 
            workOrder.CompletedAt = DateTime.UtcNow; // Variable name changed

        await _context.SaveChangesAsync();
        
        await _auditService.LogChangeAsync<WorkOrder>("UpdateStatus", "WorkOrder", workOrder); // Removed oldState parameter
        
        return Ok(new ApiResponse { Message = "Status updated successfully" }); // Changed return
    }

    [Authorize(Roles = "property_manager,admin")] // Roles changed
    [HttpPost("{id}/approve")]
    public async Task<IActionResult> ApproveWorkOrder(int id, [FromBody] ApproveWorkOrderDto dto)
    {
        var workOrder = await _context.WorkOrders.FindAsync(id); // Variable name changed
        if (workOrder == null) 
            return NotFound(new ApiResponse { Success = false, Message = "Not Found" }); // Changed NotFound return

        var oldState = new { workOrder.Status, workOrder.ApprovedBy }; // Variable name changed
        
        workOrder.Status = "Approved"; // Variable name changed
        workOrder.ApprovedBy = dto.ManagerId; // Variable name changed
        workOrder.ApprovedAt = DateTime.UtcNow; // Variable name changed

        await _context.SaveChangesAsync();

        await _auditService.LogChangeAsync<WorkOrder>("Approve", "WorkOrder", workOrder); // Removed oldState parameter
        // await _notificationService.SendAsync(wo.VendorId, "Work Order Approved", $"Work order #{wo.WorkOrderNumber} has been approved. You can start work.", "WorkOrder", wo.Id); // Removed

        return Ok(new ApiResponse { Message = "Work order approved successfully" }); // Changed return
    }
}
