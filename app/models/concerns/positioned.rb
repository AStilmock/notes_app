# Records kept in list order per user: new ones go to the end of their owner's list.
module Positioned
  extend ActiveSupport::Concern

  included do
    before_create :set_position
    scope :ordered, -> { order(:position) }
  end

  private

  def set_position
    self.position = (self.class.where(user_id: user_id).maximum(:position) || -1) + 1
  end
end
