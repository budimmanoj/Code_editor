package dev.manoj.demo.repository;

import dev.manoj.demo.model.FileNode;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FileNodeRepository extends JpaRepository<FileNode, UUID> {

    Optional<FileNode> findByIdAndRoom_Id(UUID fileNodeId, UUID roomId);

    List<FileNode> findAllByRoom_Id(UUID roomId);   // was missing — needed by getFileTree
}
