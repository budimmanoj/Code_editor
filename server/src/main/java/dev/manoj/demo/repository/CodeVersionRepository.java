package dev.manoj.demo.repository;

import dev.manoj.demo.model.CodeVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CodeVersionRepository extends JpaRepository<CodeVersion, UUID> {
    List<CodeVersion> findByFileNode_IdOrderByCreatedAtDesc(UUID fileNodeId);
}
