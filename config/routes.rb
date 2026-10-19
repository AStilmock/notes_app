Rails.application.routes.draw do
  resources :note_pads, only: %i[index show create update destroy]
  root "note_pads#index"

  get "up" => "rails/health#show", as: :rails_health_check
end
