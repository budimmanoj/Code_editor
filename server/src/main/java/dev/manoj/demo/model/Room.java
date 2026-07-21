package dev.manoj.demo.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "rooms")
public class Room {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private String name;

    @ManyToOne
    @JoinColumn(name = "owner_id")
    private User owner;

    /** 8-character alphanumeric code used to join the room */
    @Column(name = "invite_code", unique = true, nullable = false, length = 8)
    private String inviteCode;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    public UUID getId() { return id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }

    public String getInviteCode() { return inviteCode; }
    public void setInviteCode(String inviteCode) { this.inviteCode = inviteCode; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
