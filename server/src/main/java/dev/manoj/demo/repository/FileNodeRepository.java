package dev.manoj.demo.repository;

import dev.manoj.demo.dto.FileNodeInfo;
import dev.manoj.demo.model.FileNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FileNodeRepository extends JpaRepository<FileNode, UUID> {

    Optional<FileNode> findByIdAndRoom_Id(UUID fileNodeId, UUID roomId);

    List<FileNode> findAllByRoom_Id(UUID roomId);

    /**
     * Lightweight projection query for the file tree panel.
     * Only fetches id, name, type, language, and parent.id —
     * deliberately excludes the content TEXT column so loading a room
     * with hundreds of large files stays fast.
     */
    @Query("SELECT n.id AS id, n.name AS name, n.type AS type, " +
           "n.language AS language, n.parent.id AS parentId " +
           "FROM FileNode n WHERE n.room.id = :roomId")
    List<FileNodeInfo> findMetadataByRoom_Id(@Param("roomId") UUID roomId);
}
