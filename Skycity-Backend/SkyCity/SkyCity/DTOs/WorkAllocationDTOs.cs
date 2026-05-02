namespace SkycityBackend.DTOs;

public class RequestChangeDto
{
    public DateTime? DueDate { get; set; }
    public string? Description { get; set; }
}

public class Base64AttachmentsDto
{
    public List<Base64FileDto> Files { get; set; } = new();
}

public class Base64FileDto
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Data { get; set; } = string.Empty;
}

public class CreateAllocationDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int WorkId { get; set; }
    public List<int> AssignedToIds { get; set; } = new();
    public DateTime DueDate { get; set; }
    public string? Priority { get; set; }
    public Dictionary<int, string>? UserDescriptions { get; set; }
}

public class UpdateStatusDto
{
    public string Status { get; set; } = string.Empty;
    public string? Duration { get; set; }
}

public class ProgressDto
{
    public string ProgressNote { get; set; } = string.Empty;
}

public class ReassignDto
{
    public int NewUserId { get; set; }
    public string? Reason { get; set; }
}

public class DeleteAttachmentsDto
{
    public string? AttachmentName { get; set; }
}

public class SelfAssignDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int WorkId { get; set; }
    public int? ClientId { get; set; }
    public string Priority { get; set; } = "medium";
    public DateTime DueDate { get; set; }
}

public class BulkAllocationRowDto
{
    public string Title { get; set; } = string.Empty;
    public string? WorkCode { get; set; }
    public string? WorkTitle { get; set; }
    public string? AssignedTo { get; set; }
    public string? Priority { get; set; }
    public string? DueDate { get; set; }
    public string? Description { get; set; }
}
