using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkyCity.Models;
using SkycityBackend.Data;
using SkycityBackend.Models;
using System;
using System.Threading.Tasks;

namespace SkycityBackend.Controllers
{
    [Route("terms")]
    [ApiController]
    public class TermsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public TermsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetTerms()
        {
            // Fetch the first active record
            var terms = await _context.TermsAndConditions.FirstOrDefaultAsync(t => t.Status == "Active");

            if (terms == null)
                return Ok(new { success = true, data = "" });

            return Ok(new { success = true, data = terms.Content });
        }

        [HttpPost]
        public async Task<IActionResult> UpdateTerms([FromBody] TermsDto request)
        {
            var terms = await _context.TermsAndConditions.FirstOrDefaultAsync();

            if (terms == null)
            {
                terms = new TermAndCondition
                {
                    Content = request.Content ?? "",
                    Status = request.Status ?? "Active",
                    UpdatedAt = DateTime.UtcNow
                };
                _context.TermsAndConditions.Add(terms);
            }
            else
            {
                terms.Content = request.Content ?? "";
                terms.Status = request.Status ?? "Active";
                terms.UpdatedAt = DateTime.UtcNow;
                _context.TermsAndConditions.Update(terms);
            }

            await _context.SaveChangesAsync();

            return Ok(new { success = true, data = terms.Content });
        }
    }

    public class TermsDto
    {
        public string Content { get; set; }
        public string Status { get; set; } = "Active";
    }
}
