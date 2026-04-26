using System;
using System.ComponentModel.DataAnnotations;

namespace SkyCity.Models
{
    public class TermAndCondition
    {
        [Key]
        public int Id { get; set; }
        public string Content { get; set; } = string.Empty;
        public string Status { get; set; } = "Active";
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
