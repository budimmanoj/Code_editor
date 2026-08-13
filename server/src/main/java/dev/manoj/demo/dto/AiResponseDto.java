package dev.manoj.demo.dto;

import java.util.List;

/**
 * Response body returned by all AI endpoints.
 *
 * responseType:
 *   "TEXT"   — result contains a plain text / markdown answer
 *   "ACTION" — action contains a structured workspace action (CREATE_FILE, UPDATE_FILE...)
 *              that must be confirmed by the user before execution
 *   "ACTIONS"— contains a list of workspace actions
 */
public class AiResponseDto {

    private String result;
    private String model;

    /** "TEXT", "ACTION", or "ACTIONS" */
    private String responseType = "TEXT";

    /** Non-null when responseType is "ACTION" */
    private AiActionDto action;

    /** Non-null when responseType is "ACTIONS" */
    private List<AiActionDto> actions;

    public AiResponseDto() {}

    public AiResponseDto(String result, String model) {
        this.result = result;
        this.model = model;
        this.responseType = "TEXT";
    }

    public AiResponseDto(AiActionDto action, String model) {
        this.action = action;
        this.model = model;
        this.responseType = "ACTION";
    }

    public AiResponseDto(List<AiActionDto> actions, String model) {
        this.actions = actions;
        this.model = model;
        this.responseType = "ACTIONS";
    }

    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public String getResponseType() { return responseType; }
    public void setResponseType(String responseType) { this.responseType = responseType; }

    public AiActionDto getAction() { return action; }
    public void setAction(AiActionDto action) { this.action = action; }

    public List<AiActionDto> getActions() { return actions; }
    public void setActions(List<AiActionDto> actions) { this.actions = actions; }
}
