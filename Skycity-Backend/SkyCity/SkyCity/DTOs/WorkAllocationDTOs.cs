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
    public string Data { get; set; } = string.Empty; // base64 data URL
}
