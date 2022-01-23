#include "parson.h"
#include "election_json.h"

// Unmarshal
void unmarshal_election(election_t* election, const char* json_bytes, uint32_t json_len)
{
    JSON_Value* root = json_parse_string(json_bytes);
    election->name = json_object_get_string(json_object(root), "name");
    election->candidate_one = json_object_get_string(json_object(root), "candidate_one");
    election->candidate_two = json_object_get_string(json_object(root), "candidate_two");
    election->candidate_three = json_object_get_string(json_object(root), "candidate_three");
    election->winner = json_object_get_string(json_object(root), "winner");
    election->status = json_object_get_boolean(json_object(root), "status");
    json_value_free(root);
    return 1;
}

void unmarshal_vote(vote_t* vote, const char* json_bytes, uint32_t json_len)
{
    JSON_Value* root = json_parse_string(json_bytes);
    vote->vote_from = json_object_get_string(json_object(root), "vote_from");
    vote->vote_to = json_object_get_string(json_object(root), "vote_to");
    json_value_free(root);
    return 1;
}

void unmarshal_candidate(candidate_t* candidate, const char* json_bytes, uint32_t json_len) 
{
    JSON_Value* root = json_parse_string(json_bytes);
    candidate->name = json_object_get_string(json_object(root), "name");
    candidate->num_votes = json_object_get_number(json_object(root), "num_votes");
    json_value_free(root);
    return 1;
}

// Marshal
std::string marshal_election(election_t* election)
{
    JSON_Value* root_value = json_value_init_object();
    JSON_Object* root_object = json_value_get_object(root_value);
    json_object_set_string(root_object, "name", election->name.c_str());
    json_object_set_string(root_object, "candidate_one", election->candidate_one.c_str());
    json_object_set_string(root_object, "candidate_two", election->candidate_two.c_str());
    json_object_set_string(root_object, "candidate_three", election->candidate_three.c_str());
    json_object_set_string(root_object, "winner", election->winner.c_str());
    json_object_set_boolean(root_object, "status", election->status);
    char* serialized_string = json_serialize_to_string(root_value);
    std::string out(serialized_string);
    json_free_serialized_string(serialized_string);
    json_value_free(root_value);
    return out;
}

std::string marshal_vote(vote_t* vote)
{
    JSON_Value* root_value = json_value_init_object();
    JSON_Object* root_object = json_value_get_object(root_value);
    json_object_set_string(root_object, "vote_from", vote->vote_from.c_str());
    json_object_set_string(root_object, "vote_to", vote->vote_to.c_str());
    char* serialized_string = json_serialize_to_string(root_value);
    std::string out(serialized_string);
    json_free_serialized_string(serialized_string);
    json_value_free(root_value);
    return out;
}

std::string marshal_candidate(candidate_t* candidate) 
{
    JSON_Value* root_value = json_value_init_object();
    JSON_Object* root_object = json_value_get_object(root_value);
    json_object_set_string(root_object, "name", candidate->name.c_str());
    json_object_set_number(root_object, "num_votes", candidate->num_votes);
    char* serialized_string = json_serialize_to_string(root_value);
    std::string out(serialized_string);
    json_free_serialized_string(serialized_string);
    json_value_free(root_value);
    return out;
}
