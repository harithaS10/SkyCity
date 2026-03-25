using System.ComponentModel.DataAnnotations;

namespace SkycityBackend.DTOs;

public class CreatePropertyDto
{
    [Required] public int AssociationId { get; set; }
    [Required] [MaxLength(255)] public string PropertyName { get; set; } = string.Empty;
    [MaxLength(500)] public string? Address { get; set; }
    public int TotalUnits { get; set; }
}

public class CreateBuildingDto
{
    [Required] public int PropertyId { get; set; }
    [Required] [MaxLength(100)] public string BuildingName { get; set; } = string.Empty;
    public int Floors { get; set; }
}

public class CreateUnitDto
{
    [Required] public int BuildingId { get; set; }
    [Required] [MaxLength(50)] public string UnitNumber { get; set; } = string.Empty;
    public int FloorNumber { get; set; }
    public decimal Area { get; set; }
    public int? ResidentId { get; set; }
    public bool IsOccupied { get; set; }
}
