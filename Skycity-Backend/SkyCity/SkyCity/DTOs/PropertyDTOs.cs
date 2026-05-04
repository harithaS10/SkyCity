using System.ComponentModel.DataAnnotations;

namespace SkycityBackend.DTOs;

public class CreatePropertyDto
{
    public int AssociationId { get; set; }
    [Required] [MaxLength(255)] public string PropertyName { get; set; } = string.Empty;
    [MaxLength(500)] public string? Address { get; set; }
    public int TotalUnits { get; set; }
    // "apartment" or "others"
    public string PropertyType { get; set; } = "apartment";
    [MaxLength(100)] public string? TowerName { get; set; }
    [MaxLength(20)]  public string? FloorNo { get; set; }
    [MaxLength(20)]  public string? DoorNo { get; set; }
    [MaxLength(100)] public string? ContactName { get; set; }
    [MaxLength(20)]  public string? ContactMobile { get; set; }
    // For "others" — list of common area names
    public List<string>? CommonAreas { get; set; }
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

public class BulkCreateUnitsDto
{
    [Required] public int BuildingId { get; set; }
    [Required] public int FromFloor { get; set; }
    [Required] public int ToFloor { get; set; }
    [Required] public int UnitsPerFloor { get; set; }
}

public class BulkCreatePropertyDto
{
    [Required] public List<CreatePropertyDto> Properties { get; set; } = new();
}
