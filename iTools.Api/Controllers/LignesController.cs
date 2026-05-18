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
public class LignesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ArchiveService _archiveService;

    public LignesController(
        ApplicationDbContext context,
        ArchiveService archiveService)
    {
        _context = context;
        _archiveService = archiveService;
    }

    [HttpGet]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE")]
    public async Task<ActionResult<IEnumerable<LigneDto>>> GetAll()
    {
        var items = await _context.Lignes
            .OrderBy(l => l.Id)
            .Select(l => new LigneDto
            {
                Id = l.Id,
                Nom = l.Nom
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE")]
    public async Task<ActionResult<LigneDto>> GetById(int id)
    {
        var item = await _context.Lignes
            .Where(l => l.Id == id)
            .Select(l => new LigneDto
            {
                Id = l.Id,
                Nom = l.Nom
            })
            .FirstOrDefaultAsync();

        if (item == null)
        {
            return NotFound("Ligne introuvable.");
        }

        return Ok(item);
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<ActionResult<LigneDto>> Create(CreateLigneDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Nom))
        {
            return BadRequest("Le nom de la ligne est obligatoire.");
        }

        var nom = dto.Nom.Trim();

        var exists = await _context.Lignes
            .AnyAsync(l => l.Nom == nom);

        if (exists)
        {
            return BadRequest("Cette ligne existe déjà.");
        }

        var item = new Ligne
        {
            Nom = nom
        };

        _context.Lignes.Add(item);
        await _context.SaveChangesAsync();

        var result = new LigneDto
        {
            Id = item.Id,
            Nom = item.Nom
        };

        await _archiveService.AddAsync(
            action: "CREATE",
            entityName: "Ligne",
            entityId: item.Id,
            description: $"Ajout de la ligne : {item.Nom}",
            oldValues: null,
            newValues: result
        );

        return CreatedAtAction(nameof(GetById), new { id = item.Id }, result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<IActionResult> Update(int id, UpdateLigneDto dto)
    {
        var item = await _context.Lignes.FindAsync(id);

        if (item == null)
        {
            return NotFound("Ligne introuvable.");
        }

        if (string.IsNullOrWhiteSpace(dto.Nom))
        {
            return BadRequest("Le nom de la ligne est obligatoire.");
        }

        var nom = dto.Nom.Trim();

        var exists = await _context.Lignes
            .AnyAsync(l => l.Nom == nom && l.Id != id);

        if (exists)
        {
            return BadRequest("Cette ligne existe déjà.");
        }

        var oldValues = new
        {
            item.Id,
            item.Nom
        };

        item.Nom = nom;

        await _context.SaveChangesAsync();

        var newValues = new
        {
            item.Id,
            item.Nom
        };

        await _archiveService.AddAsync(
            action: "UPDATE",
            entityName: "Ligne",
            entityId: item.Id,
            description: $"Modification de la ligne : {item.Nom}",
            oldValues: oldValues,
            newValues: newValues
        );

        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _context.Lignes.FindAsync(id);

        if (item == null)
        {
            return NotFound("Ligne introuvable.");
        }

        var oldValues = new
        {
            item.Id,
            item.Nom
        };

        _context.Lignes.Remove(item);
        await _context.SaveChangesAsync();

        await _archiveService.AddAsync(
            action: "DELETE",
            entityName: "Ligne",
            entityId: id,
            description: $"Suppression de la ligne : {oldValues.Nom}",
            oldValues: oldValues,
            newValues: null
        );

        return NoContent();
    }
}