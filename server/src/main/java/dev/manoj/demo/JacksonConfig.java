package dev.manoj.demo;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fasterxml.jackson.datatype.hibernate6.Hibernate6Module;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper mapper = new ObjectMapper();

        // Support LocalDateTime
        mapper.registerModule(new JavaTimeModule());
        
        // Support Hibernate Proxies
        mapper.registerModule(new Hibernate6Module());

        return mapper;
    }
}