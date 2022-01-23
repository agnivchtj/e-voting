#pragma once

#include <stdbool.h>
#include <stdint.h>
#include <string>


typedef struct candidate_t 
{
    std::string name;
    int num_votes;
} candidate_t;


typedef struct election_t 
{
    std::string name;
    std::string candidate_one;
    std::string candidate_two;
    std::string candidate_three;
    std::string winner;
    bool status;
} election_t;


typedef struct vote_t 
{
    std::string vote_from;
    std::string vote_to;
} vote_t;


// Unmarshal
void unmarshal_election(election_t* election, const char* json_bytes, uint32_t json_len);
void unmarshal_vote(vote_t* vote, const char* json_bytes, uint32_t json_len);
void unmarshal_candidate(candidate_t* candidate, const char* json_bytes, uint32_t json_len);

// Marshal
std::string marshal_election(election_t* election);
std::string marshal_vote(vote_t* vote);
std::string marshal_candidate(candidate_t* candidate);