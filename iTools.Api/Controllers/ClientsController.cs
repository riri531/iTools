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
public class ClientsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ArchiveService _archiveService;

    public ClientsController(
        ApplicationDbContext context,
        ArchiveService archiveService)
    {
        _context = context;
        _archiveService = archiveService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ClientDto>>> GetAll()
    {
        var items = await _context.Clients
            .OrderBy(c => c.Id)
            .Select(c => new ClientDto
            {
                Id = c.Id,
                NomClient = c.NomClient,
                NomFamille = c.NomFamille,
                NomReference = c.NomReference
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ClientDto>> GetById(int id)
    {
        var item = await _context.Clients
            .Where(c => c.Id == id)
            .Select(c => new ClientDto
            {
                Id = c.Id,
                NomClient = c.NomClient,
                NomFamille = c.NomFamille,
                NomReference = c.NomReference
            })
            .FirstOrDefaultAsync();

        if (item == null)
        {
            return NotFound("Client introuvable.");
        }

        return Ok(item);
    }

    [HttpPost]
    public async Task<ActionResult<ClientDto>> Create(CreateClientDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.NomClient))
        {
            return BadRequest("Le nom du client est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.NomFamille))
        {
            return BadRequest("Le nom de famille est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.NomReference))
        {
            return BadRequest("Le nom de référence est obligatoire.");
        }

        var nomClient = dto.NomClient.Trim();
        var nomFamille = dto.NomFamille.Trim();
        var nomReference = dto.NomReference.Trim();

        var exists = await _context.Clients.AnyAsync(c =>
            c.NomClient == nomClient &&
            c.NomFamille == nomFamille &&
            c.NomReference == nomReference);

        if (exists)
        {
            return BadRequest("Ce client existe déjà.");
        }

        var item = new Client
        {
            NomClient = nomClient,
            NomFamille = nomFamille,
            NomReference = nomReference
        };

        _context.Clients.Add(item);
        await _context.SaveChangesAsync();

        var result = new ClientDto
        {
            Id = item.Id,
            NomClient = item.NomClient,
            NomFamille = item.NomFamille,
            NomReference = item.NomReference
        };

        await _archiveService.AddAsync(
            action: "CREATE",
            entityName: "Client",
            entityId: item.Id,
            description: $"Ajout du client : {item.NomClient}",
            oldValues: null,
            newValues: result
        );

        return CreatedAtAction(nameof(GetById), new { id = item.Id }, result);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, UpdateClientDto dto)
    {
        var item = await _context.Clients.FindAsync(id);

        if (item == null)
        {
            return NotFound("Client introuvable.");
        }

        if (string.IsNullOrWhiteSpace(dto.NomClient))
        {
            return BadRequest("Le nom du client est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.NomFamille))
        {
            return BadRequest("Le nom de famille est obligatoire.");
        }

        if (string.IsNullOrWhiteSpace(dto.NomReference))
        {
            return BadRequest("Le nom de référence est obligatoire.");
        }

        var nomClient = dto.NomClient.Trim();
        var nomFamille = dto.NomFamille.Trim();
        var nomReference = dto.NomReference.Trim();

        var exists = await _context.Clients.AnyAsync(c =>
            c.NomClient == nomClient &&
            c.NomFamille == nomFamille &&
            c.NomReference == nomReference &&
            c.Id != id);

        if (exists)
        {
            return BadRequest("Ce client existe déjà.");
        }

        var oldValues = new
        {
            item.Id,
            item.NomClient,
            item.NomFamille,
            item.NomReference
        };

        item.NomClient = nomClient;
        item.NomFamille = nomFamille;
        item.NomReference = nomReference;

        await _context.SaveChangesAsync();

        var newValues = new
        {
            item.Id,
            item.NomClient,
            item.NomFamille,
            item.NomReference
        };

        await _archiveService.AddAsync(
            action: "UPDATE",
            entityName: "Client",
            entityId: item.Id,
            description: $"Modification du client : {item.NomClient}",
            oldValues: oldValues,
            newValues: newValues
        );

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _context.Clients.FindAsync(id);

        if (item == null)
        {
            return NotFound("Client introuvable.");
        }

        var oldValues = new
        {
            item.Id,
            item.NomClient,
            item.NomFamille,
            item.NomReference
        };

        _context.Clients.Remove(item);
        await _context.SaveChangesAsync();

        await _archiveService.AddAsync(
            action: "DELETE",
            entityName: "Client",
            entityId: id,
            description: $"Suppression du client : {oldValues.NomClient}",
            oldValues: oldValues,
            newValues: null
        );

        return NoContent();
    }
}