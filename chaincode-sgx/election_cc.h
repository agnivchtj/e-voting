#pragma once

#include <string>
#include "shim.h"

std::string initElection(
    std::string _election_, shim_ctx_ptr_t ctx
);
std::string createElection(
    std::string election_name, 
    std::string candidate_one, std::string candidate_two, std::string candidate_three, 
    shim_ctx_ptr_t ctx
);
std::string queryElection(
    std::string election_name, shim_ctx_ptr_t ctx
);
std::string submitVote(
    std::string election_name, std::string voter_name, std::string vote_to, shim_ctx_ptr_t ctx
);
std::string closeElection(
    std::string election_name, shim_ctx_ptr_t ctx
);
std::string queryVote(
    std::string election_name, std::string voter_name, shim_ctx_ptr_t ctx
);
std::string evaluateElection(
    std::string election_name, shim_ctx_ptr_t ctx
);
