package dev.manoj.demo.repository;

import dev.manoj.demo.enums.RoomRole;
import dev.manoj.demo.model.RoomParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RoomParticipantRepository extends JpaRepository<RoomParticipant, UUID> {

    List<RoomParticipant> findByRoom_Id(UUID roomId);

    List<RoomParticipant> findByUser_Id(UUID userId);

    boolean existsByRoom_IdAndUser_Id(UUID roomId, UUID userId);

    Optional<RoomParticipant> findByRoom_IdAndUser_Id(UUID roomId, UUID userId);

    List<RoomParticipant> findByUser_IdAndRole(UUID userId, RoomRole role);
}
