package dev.manoj.demo.repository;

import dev.manoj.demo.model.CodeVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CodeVersionRepository extends JpaRepository<CodeVersion, UUID> {
    List<CodeVersion> findByFileNode_IdOrderByCreatedAtDesc(UUID fileNodeId);

    List<CodeVersion> findByFileNode_IdInOrderByCreatedAtDesc(List<UUID> fileNodeIds);

    void deleteByFileNode_Id(UUID fileNodeId);

    CodeVersion findFirstByFileNode_IdAndUser_IdOrderByCreatedAtDesc(UUID fileNodeId, UUID userId);
    
    CodeVersion findFirstByFileNode_IdOrderByCreatedAtDesc(UUID fileNodeId);

    @Query("SELECT c FROM CodeVersion c WHERE c.fileNode.room.id = :roomId AND c.status = :status ORDER BY c.createdAt DESC")
    List<CodeVersion> findByFileNode_Room_IdAndStatusOrderByCreatedAtDesc(@org.springframework.data.repository.query.Param("roomId") UUID roomId, @org.springframework.data.repository.query.Param("status") dev.manoj.demo.enums.CodeReviewStatus status);

    @Query("SELECT c FROM CodeVersion c WHERE c.fileNode.room.id = :roomId ORDER BY c.createdAt DESC")
    List<CodeVersion> findByFileNode_Room_IdOrderByCreatedAtDesc(@org.springframework.data.repository.query.Param("roomId") UUID roomId);
}
