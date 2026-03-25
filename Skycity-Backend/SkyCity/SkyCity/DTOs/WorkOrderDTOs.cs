using System.ComponentModel.DataAnnotations;

namespace SkycityBackend.DTOs;

public class CreateWorkOrderDto
{
    [Required] public int ComplaintId { get; set; }
    [Required] public int VendorId { get; set; }
    public string? WorkTitle { get; set; }
    public string? Description { get; set; }
    public decimal? EstimatedCost { get; set; }
}

public class UpdateWorkOrderStatusDto
{
    [Required] public string Status { get; set; } = string.Empty;
}

public class ApproveWorkOrderDto
{
    public int ManagerId { get; set; }
}
