package dev.manoj.demo.dto;

/** Response body returned by all AI endpoints. */
public class AiResponseDto {

    private String result;
    private String model;

    public AiResponseDto() {}

    public AiResponseDto(String result, String model) {
        this.result = result;
        this.model = model;
    }

    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
}
