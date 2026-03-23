using System.ComponentModel.DataAnnotations;

namespace SkycityBackend.DTOs;

public class CreateBillDto
{
    [Required] public int UnitId { get; set; }
    [Required] public string BillType { get; set; } = string.Empty;
    [Required] public decimal Amount { get; set; }
    public decimal Tax { get; set; }
    [Required] public DateTime DueDate { get; set; }
}

public class UpdateBillStatusDto
{
    [Required] public string Status { get; set; } = string.Empty;
    public string? PaymentReference { get; set; }
}
