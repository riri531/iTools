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
public class MatieresController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ArchiveService _archiveService;

    public MatieresController(
        ApplicationDbContext context,
        ArchiveService archiveService)
    {
        _context = context;
        _archiveService = archiveService;
    }

    [HttpGet]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE")]
    public async Task<ActionResult<IEnumerable<MatiereDto>>> GetAll()
    {
        var items = await _context.Matieres
            .OrderBy(m => m.Id)
            .Select(m => new MatiereDto
            {
                Id = m.Id,
                NomMatiere = m.NomMatiere,
                Process = m.Process
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE,EMPLOYE")]
    public async Task<ActionResult<MatiereDto>> GetById(int id)
    {
        var item = await _context.Matieres
            .Where(m => m.Id == id)
            .Select(m => new MatiereDto
            {
                Id = m.Id,
                NomMatiere = m.NomMatiere,
                Process = m.Process
            })
            .FirstOrDefaultAsync();

        if (item == null)
        {
            return NotFound("Matière introuvable.");
        }

        return Ok(item);
    }

    [HttpPost]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<ActionResult<MatiereDto>> Create(CreateMatiereDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.NomMatiere))
        {
            return BadRequest("Le nom de la matière est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Process))
        {
            return BadRequest("Le process est obligatoire.");
        }

        var nomMatiere = dto.NomMatiere.Trim();
        var process = dto.Process.Trim();

        var exists = await _context.Matieres.AnyAsync(m =>
            m.NomMatiere == nomMatiere &&
            m.Process == process);

        if (exists)
        {
            return BadRequest("Cette matière existe déjà.");
        }

        var item = new Matiere
        {
            NomMatiere = nomMatiere,
            Process = process
        };

        _context.Matieres.Add(item);
        await _context.SaveChangesAsync();

        var result = new MatiereDto
        {
            Id = item.Id,
            NomMatiere = item.NomMatiere,
            Process = item.Process
        };

        await _archiveService.AddAsync(
            action: "CREATE",
            entityName: "Matiere",
            entityId: item.Id,
            description: $"Ajout de la matière : {item.NomMatiere}",
            oldValues: null,
            newValues: result
        );

        return CreatedAtAction(nameof(GetById), new { id = item.Id }, result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<IActionResult> Update(int id, UpdateMatiereDto dto)
    {
        var item = await _context.Matieres.FindAsync(id);

        if (item == null)
        {
            return NotFound("Matière introuvable.");
        }

        if (string.IsNullOrWhiteSpace(dto.NomMatiere))
        {
            return BadRequest("Le nom de la matière est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.Process))
        {
            return BadRequest("Le process est obligatoire.");
        }

        var nomMatiere = dto.NomMatiere.Trim();
        var process = dto.Process.Trim();

        var exists = await _context.Matieres.AnyAsync(m =>
            m.NomMatiere == nomMatiere &&
            m.Process == process &&
            m.Id != id);

        if (exists)
        {
            return BadRequest("Cette matière existe déjà.");
        }

        var oldValues = new
        {
            item.Id,
            item.NomMatiere,
            item.Process
        };

        item.NomMatiere = nomMatiere;
        item.Process = process;

        await _context.SaveChangesAsync();

        var newValues = new
        {
            item.Id,
            item.NomMatiere,
            item.Process
        };

        await _archiveService.AddAsync(
            action: "UPDATE",
            entityName: "Matiere",
            entityId: item.Id,
            description: $"Modification de la matière : {item.NomMatiere}",
            oldValues: oldValues,
            newValues: newValues
        );

        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "ADMIN,RESPONSABLE")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _context.Matieres.FindAsync(id);

        if (item == null)
        {
            return NotFound("Matière introuvable.");
        }

        var oldValues = new
        {
            item.Id,
            item.NomMatiere,
            item.Process
        };

        _context.Matieres.Remove(item);
        await _context.SaveChangesAsync();

        await _archiveService.AddAsync(
            action: "DELETE",
            entityName: "Matiere",
            entityId: id,
            description: $"Suppression de la matière : {oldValues.NomMatiere}",
            oldValues: oldValues,
            newValues: null
        );

        return NoContent();
    }
}