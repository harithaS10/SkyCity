using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SkycityBackend.Interfaces;

namespace SkycityBackend.Models;

public class Association : ISoftDelete
{
    public int Id { get; set; }
    public string AssociationName { get; set; } = string.Empty;
    public int AdminId { get; set; }
    public string? LogoUrl { get; set; }
    public string ThemeColor { get; set; } = "#3B82F6";
    public string Slug { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; } = true; // true = active/visible
}

public class Property : ISoftDelete
{
    public int Id { get; set; }
    public int AssociationId { get; set; }
    public string PropertyName { get; set; } = string.Empty;
    public string? Address { get; set; }
    public int TotalUnits { get; set; }
    // Type: "apartment" | "others"
    public string PropertyType { get; set; } = "apartment";
    public string? TowerName { get; set; }
    public string? FloorNo { get; set; }
    public string? DoorNo { get; set; }
    public string? ContactName { get; set; }
    public string? ContactMobile { get; set; }
    // Comma-separated common areas for "others" type (e.g. "Swimming Pool,Club House")
    public string? CommonAreas { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = true;

    [ForeignKey("AssociationId")]
    public Association? Association { get; set; }
}

public class Building : ISoftDelete
{
    public int Id { get; set; }
    public int PropertyId { get; set; }
    public string BuildingName { get; set; } = string.Empty;
    public int Floors { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = true;

    [ForeignKey("PropertyId")]
    public Property? Property { get; set; }
}

public class Unit : ISoftDelete
{
    public int Id { get; set; }
    public int BuildingId { get; set; }
    public string UnitNumber { get; set; } = string.Empty;
    public int FloorNumber { get; set; }
    public decimal Area { get; set; }
    public int? ResidentId { get; set; }
    public bool IsOccupied { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = true;

    [ForeignKey("BuildingId")]
    public Building? Building { get; set; }
}

public class ComplaintCategory : ISoftDelete
{
    public bool IsDeleted { get; set; } = true;
    public int Id { get; set; }
    public int AssociationId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string? Department { get; set; }
    public int EstimatedTime { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Complaint : ISoftDelete
{
    public int Id { get; set; }
    public string ComplaintNumber { get; set; } = string.Empty;
    public int ResidentId { get; set; }
    public int? UnitId { get; set; }
    public int? CategoryId { get; set; }  // nullable — work type used instead of complaint category
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Priority { get; set; } = "Medium";
    public string Status { get; set; } = "Open";
    public int? AssignedTo { get; set; }
    public int? AssignedBy { get; set; }
    public DateTime? AssignedAt { get; set; }
    public string? Resolution { get; set; }
    public string? ResolutionNotes { get; set; }
    public int? Rating { get; set; }
    public string? Feedback { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ResolvedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public string? AttachmentUrls { get; set; }
    public bool IsDeleted { get; set; } = true;

    [ForeignKey("ResidentId")]
    public User? Resident { get; set; }
    [ForeignKey("UnitId")]
    public Unit? Unit { get; set; }
    [ForeignKey("CategoryId")]
    public ComplaintCategory? Category { get; set; }
    [ForeignKey("AssignedTo")]
    public User? AssignedStaff { get; set; }
    [ForeignKey("AssignedBy")]
    public User? AssistingManager { get; set; }
}

public class ComplaintAttachment : ISoftDelete
{
    public bool IsDeleted { get; set; } = true;
    public int Id { get; set; }
    public int ComplaintId { get; set; }
    public string? FileName { get; set; }
    public string? FilePath { get; set; }
    public string? FileType { get; set; }
    public int UploadedBy { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}

public class WorkOrder : ISoftDelete
{
    public int Id { get; set; }
    public string WorkOrderNumber { get; set; } = string.Empty;
    public int ComplaintId { get; set; }
    public int VendorId { get; set; }
    public string? Description { get; set; }
    public decimal? EstimatedCost { get; set; }
    public decimal? ActualCost { get; set; }
    public string Status { get; set; } = "Pending";
    public int? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = true;
    public string? WorkTitle { get; set; }

    [ForeignKey("ComplaintId")]
    public Complaint? Complaint { get; set; }
    [ForeignKey("VendorId")]
    public User? Vendor { get; set; }
}

public class Bill : ISoftDelete
{
    public int Id { get; set; }
    public int UnitId { get; set; }
    public string BillNumber { get; set; } = string.Empty;
    public string? BillType { get; set; }
    public decimal Amount { get; set; }
    public decimal Tax { get; set; }
    public decimal TotalAmount { get; set; }
    public DateTime DueDate { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime? PaidAt { get; set; }
    public string? PaymentReference { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = true;

    [ForeignKey("UnitId")]
    public Unit? Unit { get; set; }
}

public class Notification : ISoftDelete
{
    public bool IsDeleted { get; set; } = true;
    public int Id { get; set; }
    public int UserId { get; set; }
    public string? Title { get; set; }
    public string? Message { get; set; }
    public string? Type { get; set; }
    public int ReferenceId { get; set; }
    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AuditLog : ISoftDelete
{
    public bool IsDeleted { get; set; } = true;
    public int Id { get; set; }
    public int UserId { get; set; }
    public int AssociationId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string Module { get; set; } = string.Empty;
    public int? RecordId { get; set; }
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string? IPAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public enum UserRole
{
    super_admin,
    admin,
    sub_admin,
    property_manager,
    facility_manager,
    staff,
    vendor,
    resident,
    accountant,
    helpdesk
}

public class User : ISoftDelete
{
    public bool IsDeleted { get; set; } = true;
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public UserRole Role { get; set; } = UserRole.resident;
    /// <summary>Stores the custom role display name (e.g. "tester") assigned by admin.</summary>
    public string? CustomRoleName { get; set; }
    public int? AssociationId { get; set; }
    public int? PropertyId { get; set; }
    public int? BuildingId { get; set; }
    public int? UnitId { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? ProfilePicture { get; set; }
    public bool IsActive { get; set; } = true;
    public bool TermsStatus { get; set; } = false;
    public DateTime? LastLoginAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey("AssociationId")]
    public Association? Association { get; set; }
}

public class Product : ISoftDelete
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public int? SubCategoryId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = true;

    [ForeignKey("CategoryId")]
    public ComplaintCategory? Category { get; set; }
    [ForeignKey("SubCategoryId")]
    public SubCategory? SubCategory { get; set; }
}

public class SubCategory : ISoftDelete
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public string SubCategoryName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = true;

    [ForeignKey("CategoryId")]
    public ComplaintCategory? Category { get; set; }
}

public class WorkAllocation
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int WorkId { get; set; }
    public int AssignedTo { get; set; }
    public int AssignedBy { get; set; }
    public int AssociationId { get; set; }
    public string Priority { get; set; } = "medium";
    public string Status { get; set; } = "pending";
    public DateTime DueDate { get; set; }
    public string? ProgressNote { get; set; }
    public string? AttachmentUrls { get; set; }
    public string? RequestStatus { get; set; }
    public DateTime? RequestedDueDate { get; set; }
    public string? RequestedDescription { get; set; }
    public string? ReassignReason { get; set; }
    public int? ReassignedFrom { get; set; }
    public string? Duration { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Department
{
    public int Id { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public int AssociationId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ChatMessage
{
    public int Id { get; set; }
    public int SenderId { get; set; }
    public int? ReceiverId { get; set; }
    public int? GroupId { get; set; }
    public string Message { get; set; } = string.Empty;
    public string Type { get; set; } = "text";
    public string? Payload { get; set; }
    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class ChatGroup
{
    public int Id { get; set; }
    public string GroupName { get; set; } = string.Empty;
    public int CreatedBy { get; set; }
    public int AssociationId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<ChatGroupMember> Members { get; set; } = new();
}

public class ChatGroupMember
{
    public int Id { get; set; }
    public int GroupId { get; set; }
    public int UserId { get; set; }
}

public class WorkCategory
{
    public int Id { get; set; }
    public string WorkCode { get; set; } = string.Empty;
    public string WorkTitle { get; set; } = string.Empty;
    public string WorkType { get; set; } = "Standard";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class RoleDefinition : ISoftDelete
{
    public bool IsDeleted { get; set; } = true;
    public int Id { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public string RoleType { get; set; } = string.Empty;
    public int PermissionLevel { get; set; } = 0;
    public bool CanCreateUsers { get; set; } = false;
    public bool CanAssignComplaints { get; set; } = false;
    public bool CanApproveWorkOrders { get; set; } = false;
    public bool CanViewFinancials { get; set; } = false;
    public string? PermissionsJson { get; set; }
}

public class Client : ISoftDelete
{
    public int Id { get; set; }
    public int AssociationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Company { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? LogoUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Announcement : ISoftDelete
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string Message { get; set; } = string.Empty;
    public DateTime StartAt { get; set; }
    public DateTime EndAt { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; } = true; // true = visible, false = soft-deleted
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class StaffTask : ISoftDelete
{
    public int Id { get; set; }
    public int AssociationId { get; set; }
    public int AssignedTo { get; set; }
    public int AssignedBy { get; set; }
    public string TaskName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Priority { get; set; } = "medium";
    public string Status { get; set; } = "pending";
    public bool IsRecurring { get; set; } = false;
    // 'daily' = repeats every day | 'monthly' = repeats every month | null = one-time
    public string? RecurrenceType { get; set; }
    public DateTime DueDate { get; set; }
    public DateTime? CompletedAt { get; set; }
    public bool IsDeleted { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}


public class DailyReportDraft
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int AssociationId { get; set; }
    public DateTime ReportDate { get; set; }
    public string RowsJson { get; set; } = "[]";
    public bool IsSubmitted { get; set; } = false;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AssistanceRequest
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int AssociationId { get; set; }
    public string Message { get; set; } = string.Empty;
    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}


