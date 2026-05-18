using iTools.Api.Data;
using iTools.Api.DTOs;
using iTools.Api.Models;
using iTools.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace iTools.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "ADMIN,RESPONSABLE")]
public class FournisseursController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ArchiveService _archiveService;

    public FournisseursController(
        ApplicationDbContext context,
        ArchiveService archiveService)
    {
        _context = context;
        _archiveService = archiveService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<FournisseurDto>>> GetAll()
    {
        var items = await _context.Fournisseurs
            .OrderBy(f => f.Id)
            .Select(f => new FournisseurDto
            {
                Id = f.Id,
                CodeFournisseur = f.CodeFournisseur,
                NomFournisseur = f.NomFournisseur
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<FournisseurDto>> GetById(int id)
    {
        var item = await _context.Fournisseurs
            .Where(f => f.Id == id)
            .Select(f => new FournisseurDto
            {
                Id = f.Id,
                CodeFournisseur = f.CodeFournisseur,
                NomFournisseur = f.NomFournisseur
            })
            .FirstOrDefaultAsync();

        if (item == null)
        {
            return NotFound("Fournisseur introuvable.");
        }

        return Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<FournisseurDto>> Create(CreateFournisseurDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.CodeFournisseur))
        {
            return BadRequest("Le code fournisseur est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.NomFournisseur))
        {
            return BadRequest("Le nom fournisseur est obligatoire.");
        }

        var codeFournisseur = dto.CodeFournisseur.Trim();
        var nomFournisseur = dto.NomFournisseur.Trim();

        var exists = await _context.Fournisseurs.AnyAsync(f =>
            f.CodeFournisseur == codeFournisseur &&
            f.NomFournisseur == nomFournisseur);

        if (exists)
        {
            return BadRequest("Ce fournisseur existe déjà.");
        }

        var item = new Fournisseur
        {
            CodeFournisseur = codeFournisseur,
            NomFournisseur = nomFournisseur
        };

        _context.Fournisseurs.Add(item);
        await _context.SaveChangesAsync();

        var result = new FournisseurDto
        {
            Id = item.Id,
            CodeFournisseur = item.CodeFournisseur,
            NomFournisseur = item.NomFournisseur
        };

        await _archiveService.AddAsync(
            action: "CREATE",
            entityName: "Fournisseur",
            entityId: item.Id,
            description: $"Ajout du fournisseur : {item.NomFournisseur}",
            oldValues: null,
            newValues: result
        );

        return CreatedAtAction(nameof(GetById), new { id = item.Id }, result);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, UpdateFournisseurDto dto)
    {
        var item = await _context.Fournisseurs.FindAsync(id);

        if (item == null)
        {
            return NotFound("Fournisseur introuvable.");
        }

        if (string.IsNullOrWhiteSpace(dto.CodeFournisseur))
        {
            return BadRequest("Le code fournisseur est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.NomFournisseur))
        {
            return BadRequest("Le nom fournisseur est obligatoire.");
        }

        var codeFournisseur = dto.CodeFournisseur.Trim();
        var nomFournisseur = dto.NomFournisseur.Trim();

        var exists = await _context.Fournisseurs.AnyAsync(f =>
            f.CodeFournisseur == codeFournisseur &&
            f.NomFournisseur == nomFournisseur &&
            f.Id != id);

        if (exists)
        {
            return BadRequest("Ce fournisseur existe déjà.");
        }

        var oldValues = new
        {
            item.Id,
            item.CodeFournisseur,
            item.NomFournisseur
        };

        item.CodeFournisseur = codeFournisseur;
        item.NomFournisseur = nomFournisseur;

        await _context.SaveChangesAsync();

        var newValues = new
        {
            item.Id,
            item.CodeFournisseur,
            item.NomFournisseur
        };

        await _archiveService.AddAsync(
            action: "UPDATE",
            entityName: "Fournisseur",
            entityId: item.Id,
            description: $"Modification du fournisseur : {item.NomFournisseur}",
            oldValues: oldValues,
            newValues: newValues
        );

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _context.Fournisseurs.FindAsync(id);

        if (item == null)
        {
            return NotFound("Fournisseur introuvable.");
        }

        var oldValues = new
        {
            item.Id,
            item.CodeFournisseur,
            item.NomFournisseur
        };

        _context.Fournisseurs.Remove(item);
        await _context.SaveChangesAsync();

        await _archiveService.AddAsync(
            action: "DELETE",
            entityName: "Fournisseur",
            entityId: id,
            description: $"Suppression du fournisseur : {oldValues.NomFournisseur}",
            oldValues: oldValues,
            newValues: null
        );

        return NoContent();
    }
}