using System.ComponentModel.DataAnnotations;

namespace SkycityBackend.DTOs;

public class CreateComplaintDto
{
    [Required] public int ResidentId { get; set; }
    [Required] public int UnitId { get; set; }
    [Required] public int CategoryId { get; set; }
    [Required] [StringLength(255)] public string Title { get; set; } = string.Empty;
    [StringLength(5000)] public string? Description { get; set; }
    [RegularExpression("^(Low|Medium|High|Urgent)$")] public string Priority { get; set; } = "Medium";
}

public class AssignmentDto
{
    [Required] public int StaffId { get; set; }
    [Required] public int ManagerId { get; set; }
}

public class ResolutionDto
{
    [Required] [StringLength(500)] public string Resolution { get; set; } = string.Empty;
    [StringLength(1000)] public string? Notes { get; set; }
}

public class FeedbackDto
{
    [Range(1,5)] public int Rating { get; set; }
    [StringLength(1000)] public string? Feedback { get; set; }
}
