using Microsoft.EntityFrameworkCore;
using iTools.Api.Models;

namespace iTools.Api.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Role> Roles => Set<Role>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Designation> Designations => Set<Designation>();
    public DbSet<Ligne> Lignes => Set<Ligne>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Fournisseur> Fournisseurs => Set<Fournisseur>();
    public DbSet<Matiere> Matieres => Set<Matiere>();
    public DbSet<Emplacement> Emplacements => Set<Emplacement>();
    public DbSet<Outil> Outils => Set<Outil>();
}