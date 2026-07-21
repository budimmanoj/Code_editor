package dev.manoj.demo.model;

import dev.manoj.demo.enums.RoomRole;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "room_participants",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "room_id"})
    }
)
public class RoomParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id", nullable = false)
    private Room room;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RoomRole role = RoomRole.USER;

    @Column(name = "joined_at")
    private LocalDateTime joinedAt = LocalDateTime.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public Room getRoom() { return room; }
    public void setRoom(Room room) { this.room = room; }

    public RoomRole getRole() { return role; }
    public void setRole(RoomRole role) { this.role = role; }

    public LocalDateTime getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }
}
