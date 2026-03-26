using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SkycityBackend.Data;
using SkycityBackend.Models;

namespace SkycityBackend.Controllers;

[Authorize]
[ApiController]
[Route("products")]
public class ProductController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;

    public ProductController(AppDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env = env;
    }

    [HttpGet]
    public async Task<ActionResult> GetAll([FromQuery] int? categoryId, [FromQuery] string? search)
    {
        var query = _context.Products
            .Include(p => p.Category)
            .Include(p => p.SubCategory)
            .AsQueryable();

        if (categoryId.HasValue)
            query = query.Where(p => p.CategoryId == categoryId.Value);

        if (!string.IsNullOrEmpty(search))
            query = query.Where(p => p.ProductName.Contains(search));

        var items = await query.OrderByDescending(p => p.CreatedAt)
            .Select(p => new {
                p.Id, p.CategoryId,
                CategoryName = p.Category != null ? p.Category.CategoryName : "",
                p.SubCategoryId,
                SubCategoryName = p.SubCategory != null ? p.SubCategory.SubCategoryName : null,
                p.ProductName, p.Price, p.Description, p.ImageUrl, p.IsActive, p.CreatedAt
            }).ToListAsync();

        return Ok(new ApiResponse<dynamic> { Success = true, Data = items });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult> GetById(int id)
    {
        var p = await _context.Products.Include(p => p.Category).Include(p => p.SubCategory)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (p == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        return Ok(new ApiResponse<Product> { Success = true, Data = p });
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] ProductDto dto)
    {
        var product = new Product
        {
            CategoryId = dto.CategoryId,
            SubCategoryId = dto.SubCategoryId > 0 ? dto.SubCategoryId : null,
            ProductName = dto.ProductName,
            Price = dto.Price,
            Description = dto.Description,
            ImageUrl = dto.ImageUrl,
            CreatedAt = DateTime.UtcNow
        };
        _context.Products.Add(product);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse<Product> { Success = true, Data = product });
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] ProductDto dto)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });

        product.CategoryId = dto.CategoryId;
        product.SubCategoryId = dto.SubCategoryId > 0 ? dto.SubCategoryId : null;
        product.ProductName = dto.ProductName;
        product.Price = dto.Price;
        product.Description = dto.Description;
        product.ImageUrl = dto.ImageUrl ?? product.ImageUrl;
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Updated" });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        var product = await _context.Products.FindAsync(id);
        if (product == null) return NotFound(new ApiResponse { Success = false, Message = "Not found" });
        _context.Products.Remove(product);
        await _context.SaveChangesAsync();
        return Ok(new ApiResponse { Success = true, Message = "Deleted" });
    }

    [HttpPost("upload-image")]
    public async Task<ActionResult> UploadImage(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new ApiResponse { Success = false, Message = "No file provided" });

        var allowed = new[] { "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp" };
        if (!allowed.Contains(file.ContentType.ToLower()))
            return BadRequest(new ApiResponse { Success = false, Message = "Invalid file type" });

        if (file.Length > 5 * 1024 * 1024)
            return BadRequest(new ApiResponse { Success = false, Message = "File too large (max 5MB)" });

        var uploadsDir = Path.Combine(_env.WebRootPath ?? _env.ContentRootPath, "uploads", "products");
        Directory.CreateDirectory(uploadsDir);

        var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        var filePath = Path.Combine(uploadsDir, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
            await file.CopyToAsync(stream);

        var url = $"/uploads/products/{fileName}";
        return Ok(new ApiResponse<string> { Success = true, Data = url });
    }
}

public class ProductDto
{
    public int CategoryId { get; set; }
    public int? SubCategoryId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
}
