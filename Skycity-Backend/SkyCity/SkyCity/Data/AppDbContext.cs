using Microsoft.EntityFrameworkCore;
using SkycityBackend.Interfaces;
using SkycityBackend.Models;

namespace SkycityBackend.Data;

public class AppDbContext : DbContext
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AppDbContext(DbContextOptions<AppDbContext> options, IHttpContextAccessor httpContextAccessor)
        : base(options)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Association> Associations { get; set; }
    public DbSet<Property> Properties { get; set; }
    public DbSet<Building> Buildings { get; set; }
    public DbSet<Unit> Units { get; set; }
    public DbSet<ComplaintCategory> ComplaintCategories { get; set; }
    public DbSet<SubCategory> SubCategories { get; set; }
    public DbSet<Product> Products { get; set; }
    public DbSet<Complaint> Complaints { get; set; }
    public DbSet<ComplaintAttachment> ComplaintAttachments { get; set; }
    public DbSet<WorkOrder> WorkOrders { get; set; }
    public DbSet<Bill> Bills { get; set; }
    public DbSet<Notification> Notifications { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
    public DbSet<RoleDefinition> Roles { get; set; }
    public DbSet<Department> Departments { get; set; }
    public DbSet<WorkCategory> WorkCategories { get; set; }
    public DbSet<WorkAllocation> WorkAllocations { get; set; }
    public DbSet<ChatMessage> ChatMessages { get; set; }
    public DbSet<ChatGroup> ChatGroups { get; set; }
    public DbSet<ChatGroupMember> ChatGroupMembers { get; set; }
    public DbSet<Client> Clients { get; set; }
    public DbSet<StaffTask> StaffTasks { get; set; }

    public int? CurrentAssociationId => _httpContextAccessor.HttpContext?.Items["AssociationId"] as int?;
    public bool IsSuperAdmin => _httpContextAccessor.HttpContext?.User.IsInRole("super_admin") ?? false;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // User unique constraint
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();

        // Store Role enum as string to match NVARCHAR column in DB
        modelBuilder.Entity<User>()
            .Property(u => u.Role)
            .HasConversion<string>();

        // Foreign key relationships and cascade behavior
        modelBuilder.Entity<Property>()
            .HasOne(p => p.Association)
            .WithMany()
            .HasForeignKey(p => p.AssociationId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Building>()
            .HasOne(b => b.Property)
            .WithMany()
            .HasForeignKey(b => b.PropertyId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Unit>()
            .HasOne(u => u.Building)
            .WithMany()
            .HasForeignKey(u => u.BuildingId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Complaint>()
            .HasOne(c => c.Resident)
            .WithMany()
            .HasForeignKey(c => c.ResidentId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<Complaint>()
            .HasOne(c => c.AssignedStaff)
            .WithMany()
            .HasForeignKey(c => c.AssignedTo)
            .OnDelete(DeleteBehavior.NoAction);

        // Multi-tenant indexing (AssociationId/AdminId based)
        modelBuilder.Entity<Property>().HasIndex(p => p.AssociationId);
        modelBuilder.Entity<Complaint>().HasIndex(c => c.ResidentId);
        modelBuilder.Entity<Bill>().HasIndex(b => b.UnitId);
        modelBuilder.Entity<AuditLog>().HasIndex(a => a.AssociationId);

        // Global Query Filters: IsDeleted=true means active/visible, IsDeleted=false means excluded
        modelBuilder.Entity<User>().HasQueryFilter(e => e.IsDeleted);
        modelBuilder.Entity<Association>().HasQueryFilter(e => e.IsDeleted);
        modelBuilder.Entity<Property>().HasQueryFilter(e => e.IsDeleted);
        modelBuilder.Entity<Building>().HasQueryFilter(e => e.IsDeleted);
        modelBuilder.Entity<Unit>().HasQueryFilter(e => e.IsDeleted);
        modelBuilder.Entity<ComplaintCategory>().HasQueryFilter(e => e.IsDeleted);
        modelBuilder.Entity<SubCategory>().HasQueryFilter(e => e.IsDeleted);
        modelBuilder.Entity<Product>().HasQueryFilter(e => e.IsDeleted);
        modelBuilder.Entity<Complaint>().HasQueryFilter(e => e.IsDeleted);
        modelBuilder.Entity<ComplaintAttachment>().HasQueryFilter(e => e.IsDeleted);
        modelBuilder.Entity<WorkOrder>().HasQueryFilter(e => e.IsDeleted);
        modelBuilder.Entity<Bill>().HasQueryFilter(e => e.IsDeleted);
        modelBuilder.Entity<Notification>().HasQueryFilter(e => e.IsDeleted);
        modelBuilder.Entity<AuditLog>().HasQueryFilter(e => e.IsDeleted);
        modelBuilder.Entity<RoleDefinition>().HasQueryFilter(e => e.IsDeleted);
        modelBuilder.Entity<Client>().HasQueryFilter(e => e.IsDeleted);
        modelBuilder.Entity<StaffTask>().HasQueryFilter(e => e.IsDeleted);
    }

    public override int SaveChanges()
    {
        UpdateSoftDeleteStatus();
        return base.SaveChanges();
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        UpdateSoftDeleteStatus();
        return await base.SaveChangesAsync(cancellationToken);
    }

    private void UpdateSoftDeleteStatus()
    {
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.Entity is ISoftDelete entity && entry.State == EntityState.Deleted)
            {
                entry.State = EntityState.Modified;
                entity.IsDeleted = false; // false = deleted/excluded
            }
        }
    }
}
