using System.ComponentModel.DataAnnotations;

namespace SkycityBackend.DTOs;

public class CreateAssociationDto
{
    [Required][MaxLength(255)] public string AssociationName { get; set; } = string.Empty;
    public int? AdminId { get; set; }
    [Required][MaxLength(100)] public string Slug { get; set; } = string.Empty;
    [MaxLength(500)] public string? LogoUrl { get; set; }
    public string? ThemeColor { get; set; } = "#3B82F6";
    [MaxLength(500)] public string? Address { get; set; }
    [MaxLength(20)] public string? Phone { get; set; }
    [EmailAddress] public string? Email { get; set; }
}

public class UpdateAssociationDto
{
    public int Id { get; set; }
    [MaxLength(255)] public string? AssociationName { get; set; }
    public int? AdminId { get; set; }
    [MaxLength(100)] public string? Slug { get; set; }
    [MaxLength(500)] public string? LogoUrl { get; set; }
    public string? ThemeColor { get; set; }
    [MaxLength(500)] public string? Address { get; set; }
    [MaxLength(20)] public string? Phone { get; set; }
    [EmailAddress] public string? Email { get; set; }
    public bool? IsActive { get; set; }
}
