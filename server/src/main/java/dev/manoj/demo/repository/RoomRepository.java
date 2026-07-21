package dev.manoj.demo.repository;

import dev.manoj.demo.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RoomRepository extends JpaRepository<Room, UUID> {

    Optional<Room> findByInviteCode(String inviteCode);
}
