using iTools.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace iTools.Api.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users { get; set; }

        public DbSet<Role> Roles { get; set; }

        public DbSet<Designation> Designations { get; set; }

        public DbSet<Ligne> Lignes { get; set; }

        public DbSet<Client> Clients { get; set; }

        public DbSet<Fournisseur> Fournisseurs { get; set; }

        public DbSet<Matiere> Matieres { get; set; }

        public DbSet<Emplacement> Emplacements { get; set; }

        public DbSet<Outil> Outils { get; set; }

        public DbSet<ArchiveLog> ArchiveLogs { get; set; }

        public DbSet<UserNotification> UserNotifications { get; set; }

        public DbSet<Reclamation> Reclamations { get; set; }

        public DbSet<ReclamationHistory> ReclamationHistories { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>(entity =>
            {
                entity.Property(e => e.FullName)
                    .IsRequired()
                    .HasMaxLength(150);

                entity.Property(e => e.Email)
                    .IsRequired()
                    .HasMaxLength(150);

                entity.Property(e => e.PasswordHash)
                    .IsRequired();

                entity.Property(e => e.PhoneNumber)
                    .HasMaxLength(30);

                entity.Property(e => e.Address)
                    .HasMaxLength(300);

                entity.Property(e => e.ProfilePhotoUrl)
                    .HasMaxLength(500);

                entity.Property(e => e.PasswordResetTokenHash)
                    .HasMaxLength(500);

                entity.Property(e => e.PasswordResetTokenExpiresAt)
                    .IsRequired(false);
                    
                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");
            });

            modelBuilder.Entity<Fournisseur>(entity =>
            {
                entity.Property(e => e.CodeFournisseur)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(e => e.NomFournisseur)
                    .IsRequired()
                    .HasMaxLength(200);

                entity.Property(e => e.Nomenclature)
                    .HasMaxLength(150);

                entity.Property(e => e.ImageUrl)
                    .HasMaxLength(500);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");
            });

            modelBuilder.Entity<Emplacement>(entity =>
            {
                entity.Property(e => e.Armoire)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(e => e.Numero)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(e => e.Status)
                    .IsRequired()
                    .HasMaxLength(50);

                entity.Property(e => e.ImageUrl)
                    .HasMaxLength(500);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");
            });

            modelBuilder.Entity<Matiere>(entity =>
            {
                entity.Property(e => e.NomMatiere)
                    .IsRequired()
                    .HasMaxLength(150);

                entity.Property(e => e.Process)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(e => e.ImageUrl)
                    .HasMaxLength(500);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");
            });

            modelBuilder.Entity<Outil>(entity =>
            {
                entity.Property(e => e.OTT)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(e => e.CodeOutillage)
                    .IsRequired()
                    .HasMaxLength(150);

                entity.Property(e => e.Status)
                    .IsRequired()
                    .HasMaxLength(50);

                entity.Property(e => e.JustificationHS)
                    .HasMaxLength(500);

                entity.Property(e => e.ImageUrl)
                    .HasMaxLength(500);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");

                entity.Property(e => e.Valeur)
                    .HasPrecision(18, 2);
            });

            modelBuilder.Entity<ArchiveLog>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.UserId)
                    .IsRequired(false);

                entity.Property(e => e.UserName)
                    .HasMaxLength(150);

                entity.Property(e => e.Role)
                    .HasMaxLength(50);

                entity.Property(e => e.Action)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(e => e.EntityName)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(e => e.EntityId)
                    .IsRequired(false);

                entity.Property(e => e.Description)
                    .HasMaxLength(500);

                entity.Property(e => e.OldValues)
                    .HasColumnType("nvarchar(max)");

                entity.Property(e => e.NewValues)
                    .HasColumnType("nvarchar(max)");

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");
            });

            modelBuilder.Entity<UserNotification>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Title)
                    .IsRequired()
                    .HasMaxLength(200);

                entity.Property(e => e.Message)
                    .IsRequired()
                    .HasMaxLength(1000);

                entity.Property(e => e.Type)
                    .IsRequired()
                    .HasMaxLength(50);

                entity.Property(e => e.IsRead)
                    .HasDefaultValue(false);

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");

                entity.HasOne(e => e.User)
                    .WithMany()
                    .HasForeignKey(e => e.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<Reclamation>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Title)
                    .IsRequired()
                    .HasMaxLength(200);

                entity.Property(e => e.ProblemType)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(e => e.Description)
                    .IsRequired()
                    .HasColumnType("nvarchar(max)");

                entity.Property(e => e.SourcePage)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(e => e.EntityName)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(e => e.EntityLabel)
                    .HasMaxLength(250);

                entity.Property(e => e.Status)
                    .IsRequired()
                    .HasMaxLength(50)
                    .HasDefaultValue("EN_ATTENTE");

                entity.Property(e => e.Priority)
                    .IsRequired()
                    .HasMaxLength(50)
                    .HasDefaultValue("NORMALE");

                entity.Property(e => e.AssignedToRole)
                    .IsRequired()
                    .HasMaxLength(50)
                    .HasDefaultValue("RESPONSABLE");

                entity.Property(e => e.Decision)
                    .HasMaxLength(1000);

                entity.Property(e => e.Resolution)
                    .HasColumnType("nvarchar(max)");

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");

                entity.Property(e => e.UpdatedAt)
                    .HasDefaultValueSql("GETDATE()");

                entity.HasOne(e => e.CreatedByUser)
                    .WithMany()
                    .HasForeignKey(e => e.CreatedByUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.AssignedToUser)
                    .WithMany()
                    .HasForeignKey(e => e.AssignedToUserId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(e => e.TreatedByUser)
                    .WithMany()
                    .HasForeignKey(e => e.TreatedByUserId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<ReclamationHistory>(entity =>
            {
                entity.HasKey(e => e.Id);

                entity.Property(e => e.Action)
                    .IsRequired()
                    .HasMaxLength(100);

                entity.Property(e => e.OldStatus)
                    .HasMaxLength(50);

                entity.Property(e => e.NewStatus)
                    .HasMaxLength(50);

                entity.Property(e => e.Comment)
                    .HasColumnType("nvarchar(max)");

                entity.Property(e => e.CreatedAt)
                    .HasDefaultValueSql("GETDATE()");

                entity.HasOne(e => e.Reclamation)
                    .WithMany(e => e.Histories)
                    .HasForeignKey(e => e.ReclamationId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(e => e.ActionByUser)
                    .WithMany()
                    .HasForeignKey(e => e.ActionByUserId)
                    .OnDelete(DeleteBehavior.Restrict);
            });
        }
    }
}