package dev.manoj.demo.dto;

import dev.manoj.demo.enums.FileType;
import java.util.UUID;

/**
 * Spring Data JPA projection interface for file tree loading.
 *
 * By projecting only the fields we need (id, name, type, language, parentId),
 * we avoid loading the potentially large "content" TEXT column for every file
 * in the room. This is the key fix for lag when entering rooms with many files.
 */
public interface FileNodeInfo {
    UUID getId();
    String getName();
    FileType getType();
    String getLanguage();
    UUID getParentId();  // maps to parent.id via JPQL alias
    Integer getVersion();
}
